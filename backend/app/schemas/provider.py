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
    phone_secondary: str | None = None
    payout_method: str | None = None
    payout_account_reference: str | None = None


class ProviderProfileOut(BaseModel):
    id: int
    user_id: int
    business_name: str | None = None
    provider_type: str
    profile_status: str
    tier: str = "bronze"
    average_rating: float
    total_jobs_completed: int
    max_active_jobs: int = 5
    service_radius_km: float = 50.0
    payout_method: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    heading: float | None = None
    speed: float | None = None


class ProviderAvailabilityUpdate(BaseModel):
    status: str  # offline, available, busy, on_break


class ProviderDocumentCreate(BaseModel):
    document_type: str
    file_url: str


class ProviderEarningsOut(BaseModel):
    total_gross: float
    total_commission: float
    total_net: float
    total_jobs: int
    currency: str = "USD"
