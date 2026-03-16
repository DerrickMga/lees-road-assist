from datetime import datetime
from pydantic import BaseModel


class ProviderProfileCreate(BaseModel):
    business_name: str | None = None
    provider_type: str = "individual"
    phone_secondary: str | None = None
    national_id: str | None = None
    license_number: str | None = None
    payout_method: str | None = None
    payout_account_reference: str | None = None


class ProviderProfileUpdate(BaseModel):
    business_name: str | None = None
    provider_type: str | None = None
    phone_secondary: str | None = None
    national_id: str | None = None
    license_number: str | None = None
    payout_method: str | None = None
    payout_account_reference: str | None = None
    max_active_jobs: int | None = None
    service_radius_km: float | None = None


class ProviderProfileOut(BaseModel):
    id: int
    user_id: int
    business_name: str | None = None
    provider_type: str
    profile_status: str
    phone_secondary: str | None = None
    national_id: str | None = None
    license_number: str | None = None
    tier: str = "bronze"
    average_rating: float
    total_jobs_completed: int
    max_active_jobs: int = 5
    service_radius_km: float = 50.0
    payout_method: str | None = None
    payout_account_reference: str | None = None
    availability_status: str = "offline"
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    heading: float | None = None
    speed: float | None = None


class ProviderAvailabilityUpdate(BaseModel):
    status: str | None = None  # offline, available, busy, on_break
    is_available: bool | None = None


class ProviderDocumentCreate(BaseModel):
    document_type: str
    file_url: str


class ProviderDocumentOut(BaseModel):
    id: int
    provider_user_id: int
    document_type: str
    file_url: str
    verification_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderAssetCreate(BaseModel):
    asset_type: str
    registration_number: str | None = None
    make: str | None = None
    model: str | None = None
    capacity_notes: str | None = None
    is_active: bool = True


class ProviderAssetUpdate(BaseModel):
    asset_type: str | None = None
    registration_number: str | None = None
    make: str | None = None
    model: str | None = None
    capacity_notes: str | None = None
    is_active: bool | None = None


class ProviderAssetOut(BaseModel):
    id: int
    provider_user_id: int
    asset_type: str
    registration_number: str | None = None
    make: str | None = None
    model: str | None = None
    capacity_notes: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderCapabilityUpdate(BaseModel):
    service_type_ids: list[int]


class ProviderCapabilityOut(BaseModel):
    id: int
    service_type_id: int
    name: str
    code: str
    description: str | None = None
    requires_tow_vehicle: bool


class ProviderEarningsOut(BaseModel):
    total_gross: float
    total_commission: float
    total_net: float
    total_jobs: int
    currency: str = "USD"
