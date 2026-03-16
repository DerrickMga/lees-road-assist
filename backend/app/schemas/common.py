from datetime import datetime
from pydantic import BaseModel


class NotificationSend(BaseModel):
    user_id: int | None = None
    channel: str  # sms, whatsapp, push, email
    notification_type: str
    subject: str | None = None
    body: str
    related_request_id: int | None = None


class NotificationOut(BaseModel):
    id: int
    user_id: int | None = None
    channel: str
    notification_type: str
    subject: str | None = None
    body: str
    status: str
    created_at: datetime
    sent_at: datetime | None = None

    model_config = {"from_attributes": True}


class SupportTicketCreate(BaseModel):
    request_id: int | None = None
    category: str
    priority: str = "normal"
    subject: str
    description: str


class SupportTicketOut(BaseModel):
    id: int
    request_id: int | None = None
    customer_user_id: int | None = None
    provider_user_id: int | None = None
    assigned_to_user_id: int | None = None
    category: str
    priority: str
    status: str
    subject: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketMessageCreate(BaseModel):
    message_body: str
    is_internal_note: bool = False


class TicketMessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_user_id: int
    message_body: str
    is_internal_note: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentCreate(BaseModel):
    request_id: int
    incident_type: str
    severity: str = "medium"
    description: str


class SubscriptionPlanOut(BaseModel):
    id: int
    name: str
    code: str
    billing_cycle: str
    price: float
    currency: str
    included_callouts: int
    towing_discount_percent: float
    features_json: dict | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    plan_id: int


class SubscriptionOut(BaseModel):
    id: int
    user_id: int
    plan_id: int
    status: str
    start_at: datetime
    end_at: datetime
    auto_renew: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TowingEstimateRequest(BaseModel):
    request_id: int
    tow_type: str = "flatbed"
    destination_latitude: float
    destination_longitude: float
    destination_address: str | None = None


class TowingEstimateOut(BaseModel):
    estimated_distance_km: float
    base_fee: float
    per_km_fee: float
    total_estimated_fee: float
    currency: str = "USD"
