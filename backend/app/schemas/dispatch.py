from datetime import datetime
from pydantic import BaseModel


class DispatchAssignRequest(BaseModel):
    request_id: int
    provider_user_id: int | None = None  # None = auto-assign


class DispatchReassignRequest(BaseModel):
    reason: str | None = None


class DispatchAssignmentOut(BaseModel):
    id: int
    request_id: int
    provider_user_id: int
    assignment_type: str
    dispatch_status: str
    assigned_at: datetime
    accepted_at: datetime | None = None
    arrival_eta_minutes: int | None = None

    model_config = {"from_attributes": True}


class NearbyProviderOut(BaseModel):
    user_id: int
    provider_id: int
    first_name: str
    last_name: str
    distance_km: float
    average_rating: float
    total_jobs_completed: int
    tier: str = "bronze"
    score: float = 0.0
