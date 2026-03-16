from datetime import datetime
from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    request_id: int
    to_user_id: int
    rating_score: int = Field(ge=1, le=5)
    review_text: str | None = None


class RatingOut(BaseModel):
    id: int
    request_id: int
    from_user_id: int
    to_user_id: int
    rating_score: int
    review_text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QualityFlagCreate(BaseModel):
    request_id: int | None = None
    provider_user_id: int | None = None
    customer_user_id: int | None = None
    flag_type: str
    severity: str = "medium"
    description: str | None = None
