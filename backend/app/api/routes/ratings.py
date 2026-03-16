from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.rating import Rating, QualityFlag
from app.schemas.rating import RatingCreate, RatingOut, QualityFlagCreate

router = APIRouter()


@router.post("/", response_model=RatingOut, status_code=status.HTTP_201_CREATED)
async def create_rating(
    payload: RatingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Prevent duplicate rating
    existing = await db.execute(
        select(Rating).where(
            Rating.request_id == payload.request_id,
            Rating.from_user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already rated this request")

    rating = Rating(
        request_id=payload.request_id,
        from_user_id=user.id,
        to_user_id=payload.to_user_id,
        rating_score=payload.rating_score,
        review_text=payload.review_text,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)

    # Update provider average rating
    from app.models.provider import ProviderProfile
    from sqlalchemy import func
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == payload.to_user_id))
    profile = profile_result.scalar_one_or_none()
    if profile:
        avg_result = await db.execute(
            select(func.avg(Rating.rating_score)).where(Rating.to_user_id == payload.to_user_id)
        )
        avg = avg_result.scalar()
        if avg:
            profile.average_rating = round(float(avg), 2)
            await db.commit()

    return RatingOut.model_validate(rating)


@router.get("/provider/{provider_user_id}", response_model=List[RatingOut])
async def get_provider_ratings(
    provider_user_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Rating).where(Rating.to_user_id == provider_user_id).order_by(Rating.created_at.desc()).limit(50)
    )
    return [RatingOut.model_validate(r) for r in result.scalars().all()]


@router.post("/quality/flag", status_code=status.HTTP_201_CREATED)
async def create_quality_flag(
    payload: QualityFlagCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flag = QualityFlag(
        request_id=payload.request_id,
        provider_user_id=payload.provider_user_id,
        customer_user_id=payload.customer_user_id,
        flag_type=payload.flag_type,
        severity=payload.severity,
        description=payload.description,
    )
    db.add(flag)
    await db.commit()
    return {"message": "Quality flag created", "id": flag.id}
