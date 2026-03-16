import uuid as uuid_lib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.config import get_settings
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.payment import Transaction, TransactionType, TransactionStatus, Wallet, WalletLedgerEntry, ProviderPayout, PaymentWebhookLog, PaymentMethod
from app.models.request import ServiceRequest
from app.schemas.payment import (
    PaymentInitRequest, PaymentVerifyRequest, TransactionOut,
    WalletFundRequest, WalletOut, RefundRequest, PayoutProcessRequest,
    PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodOut,
)
from app.services import paynow_service

router = APIRouter()
settings = get_settings()


@router.get("/methods", response_model=List[PaymentMethodOut])
async def list_payment_methods(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PaymentMethod)
        .where(PaymentMethod.user_id == user.id)
        .order_by(PaymentMethod.is_default.desc(), PaymentMethod.created_at.desc())
    )
    return [PaymentMethodOut.model_validate(m) for m in result.scalars().all()]


@router.post("/methods", response_model=PaymentMethodOut, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    payload: PaymentMethodCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    method = PaymentMethod(
        user_id=user.id,
        provider_name=payload.provider_name,
        payment_type=payload.payment_type,
        masked_reference=payload.masked_reference,
        token_reference=payload.token_reference,
        is_default=payload.is_default,
    )

    if payload.is_default:
        existing = await db.execute(
            select(PaymentMethod).where(
                PaymentMethod.user_id == user.id,
                PaymentMethod.is_default == True,
            )
        )
        for m in existing.scalars().all():
            m.is_default = False

    db.add(method)
    await db.commit()
    await db.refresh(method)
    return PaymentMethodOut.model_validate(method)


@router.put("/methods/{method_id}", response_model=PaymentMethodOut)
async def update_payment_method(
    method_id: int,
    payload: PaymentMethodUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PaymentMethod).where(
            PaymentMethod.id == method_id,
            PaymentMethod.user_id == user.id,
        )
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment method not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(method, field, value)

    if payload.is_default is True:
        existing = await db.execute(
            select(PaymentMethod).where(
                PaymentMethod.user_id == user.id,
                PaymentMethod.id != method_id,
                PaymentMethod.is_default == True,
            )
        )
        for m in existing.scalars().all():
            m.is_default = False

    await db.commit()
    await db.refresh(method)
    return PaymentMethodOut.model_validate(method)


@router.delete("/methods/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_method(
    method_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PaymentMethod).where(
            PaymentMethod.id == method_id,
            PaymentMethod.user_id == user.id,
        )
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment method not found")

    await db.delete(method)
    await db.commit()


# ─── Internal WhatsApp payment endpoint ──────────────────────────────────────

@router.post("/whatsapp-init")
async def whatsapp_init_payment(
    request: Request,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the WhatsApp bot to initialize payment for a service request.
    Uses X-Internal-Key instead of JWT so the bot can act without a user token.

    Expected JSON body:
    {
        "request_uuid": "...",
        "payment_provider": "ecocash",   // cash | ecocash | innbucks | onemoney
        "phone_number": "+263771234567", // mobile money phone (omit for cash)
        "amount": 15.00,                 // optional override; uses estimated_price if absent
        "currency": "USD"
    }
    """
    expected_key = settings.internal_api_key
    if expected_key and x_internal_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    request_uuid = body.get("request_uuid", "")
    payment_provider = (body.get("payment_provider", "cash") or "cash").lower().strip()
    phone_number = body.get("phone_number", "")
    currency = body.get("currency", "USD")

    # Validate payment provider
    allowed = {"cash", "ecocash", "innbucks", "onemoney", "paynow"}
    if payment_provider not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported payment provider: {payment_provider}")

    # Look up service request
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.uuid == request_uuid))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")

    amount = float(body.get("amount") or sr.estimated_price or 10.0)
    internal_ref = f"WA-{uuid_lib.uuid4().hex[:12].upper()}"

    txn = Transaction(
        request_id=sr.id,
        user_id=sr.customer_user_id,
        transaction_type=TransactionType.PAYMENT,
        payment_provider=payment_provider,
        internal_reference=internal_ref,
        amount=amount,
        currency=currency,
        status=TransactionStatus.INITIATED,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    redirect_url: str | None = None
    poll_url: str | None = None

    if payment_provider == "cash":
        txn.status = TransactionStatus.PENDING
        await db.commit()
        await db.refresh(txn)
        return {
            "ok": True,
            "method": "cash",
            "internal_reference": internal_ref,
            "amount": amount,
            "message": "Cash payment pending — customer will pay on arrival.",
        }

    # Mobile money via Paynow
    result = await paynow_service.initiate_paynow(
        integration_id=settings.paynow_integration_id,
        integration_key=settings.paynow_integration_key,
        reference=internal_ref,
        amount=amount,
        additional_info=f"Lee's Road Assist — Ref {request_uuid[:8]}",
        return_url=settings.paynow_return_url,
        result_url=settings.paynow_result_url,
        authemail=phone_number or "",
    )
    if result["ok"]:
        redirect_url = result.get("redirect_url")
        poll_url = result.get("poll_url")
        txn.provider_reference = poll_url
    else:
        txn.status = TransactionStatus.FAILED
        txn.failure_reason = result.get("error", "Paynow error")
        await db.commit()
        return {
            "ok": False,
            "method": payment_provider,
            "internal_reference": internal_ref,
            "error": txn.failure_reason,
        }

    await db.commit()
    await db.refresh(txn)
    return {
        "ok": True,
        "method": payment_provider,
        "internal_reference": internal_ref,
        "amount": amount,
        "redirect_url": redirect_url,
        "poll_url": poll_url,
        "message": f"USSD push triggered for {phone_number}. Ask customer to check their phone.",
    }


@router.post("/initialize", response_model=TransactionOut)
async def initialize_payment(
    payload: PaymentInitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == payload.request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    # Validate payment provider against enabled methods
    enabled = settings.paynow_enabled_methods.split(",")
    if payload.payment_provider not in ["cash", "stripe"] and payload.payment_provider not in enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Payment method '{payload.payment_provider}' is not enabled")

    internal_ref = f"TXN-{uuid_lib.uuid4().hex[:12].upper()}"

    txn = Transaction(
        request_id=payload.request_id,
        user_id=user.id,
        transaction_type=TransactionType.PAYMENT,
        payment_provider=payload.payment_provider,
        internal_reference=internal_ref,
        amount=payload.amount,
        currency=payload.currency,
        status=TransactionStatus.INITIATED,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    redirect_url: str | None = None
    poll_url: str | None = None

    mobile_methods = [m.strip() for m in settings.paynow_enabled_methods.split(",")]

    if payload.payment_provider == "cash":
        txn.status = TransactionStatus.PENDING
        await db.commit()
        await db.refresh(txn)

    elif payload.payment_provider in mobile_methods or payload.payment_provider == "paynow":
        result = await paynow_service.initiate_paynow(
            integration_id=settings.paynow_integration_id,
            integration_key=settings.paynow_integration_key,
            reference=internal_ref,
            amount=payload.amount,
            additional_info=f"Lee's Road Assist - Request #{payload.request_id}",
            return_url=settings.paynow_return_url,
            result_url=settings.paynow_result_url,
            authemail=payload.phone_number or "",
        )
        if result["ok"]:
            redirect_url = result["redirect_url"]
            poll_url = result["poll_url"]
            txn.provider_reference = result["poll_url"]  # store poll URL for later verification
        else:
            txn.status = TransactionStatus.FAILED
            txn.failure_reason = result["error"]
        await db.commit()
        await db.refresh(txn)

    out = TransactionOut.model_validate(txn)
    if redirect_url:
        out = out.model_copy(update={"redirect_url": redirect_url, "poll_url": poll_url})
    return out


@router.post("/verify", response_model=TransactionOut)
async def verify_payment(
    payload: PaymentVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.internal_reference == payload.internal_reference)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if payload.provider_reference:
        txn.provider_reference = payload.provider_reference

    # If we stored a poll_url as provider_reference, verify with Paynow
    if txn.provider_reference and txn.provider_reference.startswith("http"):
        poll_result = await paynow_service.poll_paynow_status(txn.provider_reference)
        if poll_result.get("paid"):
            txn.status = TransactionStatus.SUCCESSFUL
            txn.paid_at = datetime.now(timezone.utc)
        elif poll_result.get("ok") and not poll_result.get("paid"):
            # Still awaiting payment — keep status as INITIATED
            pass
        else:
            txn.status = TransactionStatus.FAILED
    else:
        # Fallback: mark successful (cash or manual confirmation)
        txn.status = TransactionStatus.SUCCESSFUL
        txn.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(txn)
    return TransactionOut.model_validate(txn)


@router.post("/webhook/{provider}")
async def payment_webhook(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Receive webhooks from Paynow, EcoCash, InnBucks, OneMoney, or Stripe."""
    body = await request.body()
    log = PaymentWebhookLog(
        provider_name=provider,
        event_type="webhook",
        payload_json={"raw": body.decode("utf-8", errors="replace")},
    )
    db.add(log)

    # Parse based on provider
    if provider == "paynow":
        form = await request.form()
        reference = form.get("reference", "")
        paynow_status = form.get("status", "")
        result = await db.execute(
            select(Transaction).where(Transaction.internal_reference == reference)
        )
        txn = result.scalar_one_or_none()
        if txn:
            if paynow_status.lower() in ("paid", "delivered"):
                txn.status = TransactionStatus.SUCCESSFUL
                txn.paid_at = datetime.now(timezone.utc)
            elif paynow_status.lower() in ("failed", "cancelled"):
                txn.status = TransactionStatus.FAILED
            log.processed_status = "processed"
            log.processed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"status": "ok"}


@router.post("/wallet/fund", response_model=TransactionOut)
async def fund_wallet(
    payload: WalletFundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    internal_ref = f"WLT-{uuid_lib.uuid4().hex[:12].upper()}"
    txn = Transaction(
        user_id=user.id,
        transaction_type=TransactionType.WALLET_FUND,
        payment_provider=payload.payment_provider,
        internal_reference=internal_ref,
        amount=payload.amount,
        currency="USD",
        status=TransactionStatus.INITIATED,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return TransactionOut.model_validate(txn)


@router.get("/wallet/balance", response_model=WalletOut)
async def wallet_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=user.id, available_balance=0, pending_balance=0, currency="USD", status="active")
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    return WalletOut.model_validate(wallet)


@router.get("/transactions", response_model=List[TransactionOut])
async def list_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(50)
    )
    return [TransactionOut.model_validate(t) for t in result.scalars().all()]


@router.post("/refunds/request")
async def request_refund(
    payload: RefundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Transaction).where(Transaction.id == payload.transaction_id, Transaction.user_id == user.id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if txn.status != TransactionStatus.SUCCESSFUL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only successful transactions can be refunded")

    refund_ref = f"REF-{uuid_lib.uuid4().hex[:12].upper()}"
    refund = Transaction(
        request_id=txn.request_id,
        user_id=user.id,
        transaction_type=TransactionType.REFUND,
        payment_provider=txn.payment_provider,
        internal_reference=refund_ref,
        amount=txn.amount,
        currency=txn.currency,
        status=TransactionStatus.PENDING,
    )
    db.add(refund)
    await db.commit()
    return {"message": "Refund requested", "refund_reference": refund_ref}


@router.post("/payouts/process")
async def process_payout(
    payload: PayoutProcessRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    payout = ProviderPayout(
        provider_user_id=payload.provider_user_id,
        request_id=payload.request_id,
        gross_amount=0,
        commission_amount=0,
        net_amount=0,
        currency="USD",
        payout_status="pending",
    )
    db.add(payout)
    await db.commit()
    return {"message": "Payout queued", "payout_id": payout.id}
