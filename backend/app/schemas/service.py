from datetime import datetime
from pydantic import BaseModel


class ServiceCategoryOut(BaseModel):
    id: int
    name: str
    code: str
    description: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class ServiceTypeOut(BaseModel):
    id: int
    category_id: int
    name: str
    code: str
    description: str | None = None
    requires_tow_vehicle: bool
    requires_photo: bool
    estimated_duration_minutes: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class PricingEstimateRequest(BaseModel):
    service_type_code: str
    pickup_latitude: float
    pickup_longitude: float
    destination_latitude: float | None = None
    destination_longitude: float | None = None
    promo_code: str | None = None


class PricingEstimateOut(BaseModel):
    service_fee: float
    callout_fee: float
    towing_distance_km: float
    towing_cost: float
    subtotal: float
    discount: float
    total: float
    currency: str


class PromoValidateRequest(BaseModel):
    code: str


class PromoValidateOut(BaseModel):
    valid: bool
    discount_type: str | None = None
    discount_value: float | None = None
    message: str
