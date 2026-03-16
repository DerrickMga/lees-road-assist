from datetime import datetime
from pydantic import BaseModel


class ServiceRequestCreate(BaseModel):
    service_type_id: int
    vehicle_id: int | None = None
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str | None = None
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    destination_address: str | None = None
    issue_description: str | None = None
    priority_level: str = "normal"
    channel: str = "app"


class WhatsAppRequestCreate(BaseModel):
    """Used by the WhatsApp bot to create requests on behalf of a customer."""
    phone: str                          # customer WhatsApp number (E.164)
    service_slug: str                   # maps to ServiceType.code
    pickup_address: str | None = None
    issue_description: str | None = None
    channel: str = "whatsapp"
    payment_method: str = "cash"        # passed through to confirm message


class ServiceRequestOut(BaseModel):
    id: int
    uuid: str
    customer_user_id: int
    vehicle_id: int | None = None
    service_type_id: int
    service_type_name: str | None = None  # populated by route handlers
    assignment_id: int | None = None      # populated by providers route
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str | None = None
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    destination_address: str | None = None
    issue_description: str | None = None
    priority_level: str
    channel: str
    current_status: str
    estimated_price: float | None = None
    final_price: float | None = None
    currency: str
    pricing_breakdown: dict | None = None  # populated at creation
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceRequestCancel(BaseModel):
    reason: str | None = None


class RequestTimelineOut(BaseModel):
    id: int
    old_status: str | None = None
    new_status: str
    change_source: str
    note: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
