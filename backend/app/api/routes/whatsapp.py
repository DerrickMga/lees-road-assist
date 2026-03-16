"""
WhatsApp Webhook — Meta Cloud API + VitalBot Gateway

Handles:
  GET  /webhook  → Meta verification challenge
  POST /webhook  → Incoming messages from WhatsApp
  POST /send     → Outbound message (admin/system)
"""

import hmac
import hashlib
import logging
import uuid as _uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.core.database import get_db
from app.core.config import get_settings
from app.api.deps import require_admin
from app.models.user import User
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory
from app.models.service import ServiceType
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage, BotStatePayload

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("whatsapp")


# ──────────────────────────────────────────────
# Meta Webhook Verification (GET)
# ──────────────────────────────────────────────
@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Meta sends a GET with hub.mode, hub.verify_token and hub.challenge.
    We must return the challenge if the verify_token matches.
    FastAPI doesn't handle dots in query param names natively, so we read from raw query.
    """
    params = dict(request.query_params)
    hub_mode = params.get("hub.mode")
    hub_verify_token = params.get("hub.verify_token")
    hub_challenge = params.get("hub.challenge", "")

    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification failed")


# ──────────────────────────────────────────────
# Meta Webhook Incoming (POST)
# ──────────────────────────────────────────────
@router.post("/webhook")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive incoming WhatsApp messages via Meta Cloud API webhook.
    Stores messages, maintains conversation state, and optionally
    forwards to VitalBot for AI processing.
    """
    body = await request.json()

    # Extract message entries
    entries = body.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            statuses = value.get("statuses", [])

            # --- Handle delivery status updates ---
            for s in statuses:
                msg_id = s.get("id")
                new_status = s.get("status")  # sent, delivered, read, failed
                if msg_id:
                    result = await db.execute(
                        select(WhatsAppMessage).where(WhatsAppMessage.provider_message_id == msg_id)
                    )
                    wa_msg = result.scalar_one_or_none()
                    if wa_msg:
                        wa_msg.sent_status = new_status

            # --- Handle incoming messages ---
            for msg in messages:
                phone = msg.get("from", "")
                msg_id = msg.get("id", "")
                msg_type = msg.get("type", "text")
                timestamp = msg.get("timestamp", "")

                # Extract content based on type
                content_text = None
                media_url = None
                if msg_type == "text":
                    content_text = msg.get("text", {}).get("body", "")
                elif msg_type == "location":
                    loc = msg.get("location", {})
                    content_text = f"lat:{loc.get('latitude')},lng:{loc.get('longitude')}"
                elif msg_type == "image":
                    media_url = msg.get("image", {}).get("id", "")
                    content_text = msg.get("image", {}).get("caption", "")
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
                    content_text = reply.get("id", "") or reply.get("title", "")

                # Get or create conversation
                conv_result = await db.execute(
                    select(WhatsAppConversation).where(WhatsAppConversation.phone == phone)
                )
                conversation = conv_result.scalar_one_or_none()
                if not conversation:
                    # Try to match with existing user
                    user_result = await db.execute(select(User).where(User.phone == phone))
                    user = user_result.scalar_one_or_none()

                    conversation = WhatsAppConversation(
                        customer_user_id=user.id if user else None,
                        phone=phone,
                        session_status="active",
                        current_flow="greeting",
                        last_message_at=datetime.now(timezone.utc),
                    )
                    db.add(conversation)
                    await db.flush()

                conversation.last_message_at = datetime.now(timezone.utc)

                # Store inbound message
                wa_message = WhatsAppMessage(
                    conversation_id=conversation.id,
                    direction="inbound",
                    message_type=msg_type,
                    content_text=content_text,
                    media_url=media_url,
                    provider_message_id=msg_id,
                    sent_status="delivered",
                )
                db.add(wa_message)
                await db.flush()

                # --- Forward to VitalBot for processing (if enabled) ---
                if settings.enable_webhook_routing and settings.vitalbot_api_url:
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            await client.post(
                                f"{settings.vitalbot_api_url}/webhook",
                                json={
                                    "phone": phone,
                                    "message": content_text,
                                    "message_type": msg_type,
                                    "conversation_id": conversation.id,
                                    "provider_message_id": msg_id,
                                },
                            )
                    except Exception as e:
                        logger.warning(f"VitalBot forward failed: {e}")

    await db.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────
# Send outbound WhatsApp message
# ──────────────────────────────────────────────
@router.post("/send")
async def send_whatsapp_message(
    to: str,
    message: str,
    message_type: str = "text",
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Send an outbound WhatsApp message via Meta Cloud API.
    """
    url = f"{settings.whatsapp_api_url}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }

    provider_msg_id = None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            provider_msg_id = data.get("messages", [{}])[0].get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"WhatsApp send failed: {e.response.text}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to send WhatsApp message")
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="WhatsApp API error")

    # Store outbound message
    conv_result = await db.execute(select(WhatsAppConversation).where(WhatsAppConversation.phone == to))
    conversation = conv_result.scalar_one_or_none()
    if conversation:
        wa_msg = WhatsAppMessage(
            conversation_id=conversation.id,
            direction="outbound",
            message_type="text",
            content_text=message,
            provider_message_id=provider_msg_id,
            sent_status="sent",
        )
        db.add(wa_msg)
        await db.commit()

    return {"status": "sent", "provider_message_id": provider_msg_id}


# ──────────────────────────────────────────────
# Send interactive message (buttons/lists)
# ──────────────────────────────────────────────
@router.post("/send-interactive")
async def send_interactive_message(
    to: str,
    interactive_payload: dict,
    _admin: User = Depends(require_admin),
):
    """Send an interactive message (buttons, list) via Meta Cloud API."""
    url = f"{settings.whatsapp_api_url}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": interactive_payload,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return {"status": "sent", "data": data}
    except Exception as e:
        logger.error(f"Interactive send error: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to send interactive message")


# ──────────────────────────────────────────────
# WhatsApp-channel service request creation
# (called by the standalone whatsapp_webhook.py bot server)
# ──────────────────────────────────────────────

class WhatsAppRequestIn(BaseModel):
    phone: str
    service_slug: str          # matches ServiceType.code
    pickup_address: str
    issue_description: str = ""
    channel: str = "whatsapp"


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_whatsapp_request(
    payload: WhatsAppRequestIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a service request submitted via WhatsApp bot.
    Matches the phone number to an existing user (if any).
    The service_slug maps to ServiceType.code.
    No authentication required — internal bot endpoint.
    """
    # Resolve service type
    svc_result = await db.execute(
        select(ServiceType).where(ServiceType.code == payload.service_slug, ServiceType.is_active == True)
    )
    service_type = svc_result.scalar_one_or_none()

    # Resolve user by phone (optional — request can be anonymous)
    user_result = await db.execute(select(User).where(User.phone == payload.phone))
    user = user_result.scalar_one_or_none()

    sr = ServiceRequest(
        uuid=str(_uuid.uuid4()),
        customer_user_id=user.id if user else None,
        service_type_id=service_type.id if service_type else None,
        pickup_address=payload.pickup_address,
        issue_description=payload.issue_description,
        channel=payload.channel,
        current_status=RequestStatus.PENDING,
    )
    db.add(sr)
    await db.flush()

    db.add(RequestStatusHistory(
        request_id=sr.id,
        old_status=None,
        new_status=RequestStatus.PENDING.value,
        changed_by_user_id=user.id if user else None,
        change_source="whatsapp_bot",
        note=f"Request via WhatsApp — {payload.phone}",
    ))
    await db.commit()
    await db.refresh(sr)

    logger.info(f"WhatsApp request created: uuid={sr.uuid} phone={payload.phone} service={payload.service_slug}")
    return {"uuid": sr.uuid, "status": sr.current_status.value, "service_slug": payload.service_slug}
