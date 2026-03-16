from datetime import datetime
from pydantic import BaseModel


class PaymentInitRequest(BaseModel):
    request_id: int
    payment_provider: str = "cash"  # cash, ecocash, innbucks, onemoney, stripe
    amount: float
    currency: str = "USD"
    phone_number: str | None = None  # customer mobile number for EcoCash USSD push


class PaymentVerifyRequest(BaseModel):
    internal_reference: str
    provider_reference: str | None = None


class TransactionOut(BaseModel):
    id: int
    request_id: int | None = None
    user_id: int
    transaction_type: str
    payment_provider: str
    internal_reference: str
    amount: float
    currency: str
    status: str
    paid_at: datetime | None = None
    created_at: datetime
    # Paynow-specific — populated at payment initialization, not stored in DB
    redirect_url: str | None = None
    poll_url: str | None = None

    model_config = {"from_attributes": True}


class PriceQuoteOut(BaseModel):
    """Price breakdown returned before a customer confirms & pays."""
    service_fee: float
    callout_fee: float
    towing_cost: float
    subtotal: float
    discount: float
    total: float
    currency: str
    dispatch_distance_km: float
    towing_distance_km: float


class WalletFundRequest(BaseModel):
    amount: float
    payment_provider: str = "ecocash"


class WalletOut(BaseModel):
    id: int
    available_balance: float
    pending_balance: float
    currency: str
    status: str

    model_config = {"from_attributes": True}


class RefundRequest(BaseModel):
    transaction_id: int
    reason: str | None = None


class PayoutProcessRequest(BaseModel):
    provider_user_id: int
    request_id: int | None = None


class PaymentMethodCreate(BaseModel):
    provider_name: str
    payment_type: str = "mobile_money"
    masked_reference: str | None = None
    token_reference: str | None = None
    is_default: bool = False


class PaymentMethodUpdate(BaseModel):
    provider_name: str | None = None
    payment_type: str | None = None
    masked_reference: str | None = None
    token_reference: str | None = None
    is_default: bool | None = None


class PaymentMethodOut(BaseModel):
    id: int
    user_id: int
    provider_name: str
    payment_type: str
    masked_reference: str | None = None
    token_reference: str | None = None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
