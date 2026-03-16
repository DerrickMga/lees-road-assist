from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.api.deps import get_current_user, require_provider
from app.models.user import User
from app.models.towing import TowingDetail, TowingEvent
from app.models.request import ServiceRequest
from app.schemas.common import TowingEstimateRequest, TowingEstimateOut
from app.services.pricing import _haversine_km, TOWING_PER_KM

router = APIRouter()


@router.post("/estimate", response_model=TowingEstimateOut)
async def towing_estimate(
    payload: TowingEstimateRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == payload.request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    dist = _haversine_km(
        sr.pickup_latitude, sr.pickup_longitude,
        payload.destination_latitude, payload.destination_longitude,
    )
    base_fee = 10.0  # base towing fee
    per_km = TOWING_PER_KM
    total = base_fee + (dist * per_km)

    return TowingEstimateOut(
        estimated_distance_km=round(dist, 2),
        base_fee=base_fee,
        per_km_fee=per_km,
        total_estimated_fee=round(total, 2),
    )


@router.post("/{request_id}/confirm")
async def confirm_towing(
    request_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    existing = await db.execute(select(TowingDetail).where(TowingDetail.request_id == request_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Towing already confirmed")

    detail = TowingDetail(
        request_id=request_id,
        tow_type="flatbed",
        destination_latitude=sr.destination_latitude,
        destination_longitude=sr.destination_longitude,
        destination_address=sr.destination_address,
    )
    if sr.destination_latitude and sr.destination_longitude:
        dist = _haversine_km(sr.pickup_latitude, sr.pickup_longitude, sr.destination_latitude, sr.destination_longitude)
        detail.estimated_distance_km = round(dist, 2)
        detail.agreed_per_km_fee = TOWING_PER_KM
        detail.agreed_base_fee = 10.0
        detail.total_estimated_towing_fee = round(10.0 + dist * TOWING_PER_KM, 2)

    db.add(detail)
    await db.commit()
    return {"message": "Towing confirmed", "id": detail.id}


@router.get("/{request_id}")
async def get_towing_detail(
    request_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TowingDetail).where(TowingDetail.request_id == request_id))
    detail = result.scalar_one_or_none()
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Towing detail not found")
    return {
        "id": detail.id,
        "request_id": detail.request_id,
        "tow_type": detail.tow_type,
        "estimated_distance_km": detail.estimated_distance_km,
        "agreed_base_fee": detail.agreed_base_fee,
        "agreed_per_km_fee": detail.agreed_per_km_fee,
        "total_estimated_towing_fee": detail.total_estimated_towing_fee,
        "destination_address": detail.destination_address,
    }
