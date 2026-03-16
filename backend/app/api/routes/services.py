from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.service import ServiceCategory, ServiceType, PromoCode
from app.schemas.service import (
    ServiceCategoryOut, ServiceTypeOut,
    PricingEstimateRequest, PricingEstimateOut,
    PromoValidateRequest, PromoValidateOut,
)
from app.services.pricing import calculate_price

router = APIRouter()


@router.get("/categories", response_model=List[ServiceCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ServiceCategory).where(ServiceCategory.is_active == True).order_by(ServiceCategory.name))
    return [ServiceCategoryOut.model_validate(c) for c in result.scalars().all()]


@router.get("/types", response_model=List[ServiceTypeOut])
async def list_service_types(category_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(ServiceType).where(ServiceType.is_active == True)
    if category_id:
        q = q.where(ServiceType.category_id == category_id)
    result = await db.execute(q.order_by(ServiceType.name))
    return [ServiceTypeOut.model_validate(st) for st in result.scalars().all()]


@router.get("/types/{type_id}", response_model=ServiceTypeOut)
async def get_service_type(type_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ServiceType).where(ServiceType.id == type_id))
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
    return ServiceTypeOut.model_validate(st)


@router.post("/pricing/estimate", response_model=PricingEstimateOut)
async def pricing_estimate(
    payload: PricingEstimateRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Resolve service_type by code
    result = await db.execute(select(ServiceType).where(ServiceType.code == payload.service_type_code))
    st = result.scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")

    promo_discount = 0.0
    if payload.promo_code:
        promo_result = await db.execute(select(PromoCode).where(PromoCode.code == payload.promo_code, PromoCode.is_active == True))
        promo = promo_result.scalar_one_or_none()
        if promo and (not promo.end_at or promo.end_at > datetime.now(timezone.utc)):
            promo_discount = promo.discount_value if promo.discount_type == "fixed" else 0.0

    price = await calculate_price(
        db=db,
        service_type_id=st.id,
        pickup_lat=payload.pickup_latitude,
        pickup_lng=payload.pickup_longitude,
        dest_lat=payload.destination_latitude,
        dest_lng=payload.destination_longitude,
        promo_discount=promo_discount,
    )
    return PricingEstimateOut(**price)


@router.post("/promo/validate", response_model=PromoValidateOut)
async def validate_promo(payload: PromoValidateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromoCode).where(PromoCode.code == payload.code))
    promo = result.scalar_one_or_none()
    if not promo or not promo.is_active:
        return PromoValidateOut(valid=False, message="Invalid or inactive promo code")
    if promo.end_at and promo.end_at < datetime.now(timezone.utc):
        return PromoValidateOut(valid=False, message="Promo code has expired")
    return PromoValidateOut(
        valid=True,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        message="Promo code is valid",
    )
