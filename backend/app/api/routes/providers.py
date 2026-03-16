from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_provider
from app.models.user import User
from app.models.provider import (
    ProviderProfile, ProviderDocument, ProviderAvailability,
    ProviderLocation, ProviderAvailabilityStatus,
)
from app.models.dispatch import DispatchAssignment, DispatchStatus
from app.models.payment import ProviderPayout
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory
from app.schemas.provider import (
    ProviderProfileCreate, ProviderProfileUpdate, ProviderProfileOut,
    ProviderLocationUpdate, ProviderAvailabilityUpdate,
    ProviderDocumentCreate, ProviderEarningsOut,
)
from app.schemas.request import ServiceRequestOut

router = APIRouter()


@router.get("/profile", response_model=ProviderProfileOut)
async def get_provider_profile(user: User = Depends(require_provider), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")
    return ProviderProfileOut.model_validate(profile)


@router.put("/profile", response_model=ProviderProfileOut)
async def update_provider_profile(
    payload: ProviderProfileUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return ProviderProfileOut.model_validate(profile)


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    payload: ProviderDocumentCreate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")
    doc = ProviderDocument(
        provider_user_id=profile.id,
        document_type=payload.document_type,
        file_url=payload.file_url,
    )
    db.add(doc)
    await db.commit()
    return {"message": "Document uploaded", "id": doc.id}


@router.get("/jobs", response_model=List[ServiceRequestOut])
async def list_provider_jobs(
    status_filter: str | None = None,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ServiceRequest)
        .join(DispatchAssignment, DispatchAssignment.request_id == ServiceRequest.id)
        .where(DispatchAssignment.provider_user_id == user.id)
    )
    if status_filter:
        q = q.where(ServiceRequest.current_status == RequestStatus(status_filter))
    result = await db.execute(q.order_by(ServiceRequest.created_at.desc()))
    out = []
    for r in result.scalars().all():
        item = ServiceRequestOut.model_validate(r)
        item.service_type_name = r.service_type.name if r.service_type else None
        for da in r.dispatch_assignments:
            if da.provider_user_id == user.id:
                item.assignment_id = da.id
                break
        out.append(item)
    return out


@router.post("/jobs/{assignment_id}/arrived")
async def mark_arrived(
    assignment_id: int,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DispatchAssignment).where(DispatchAssignment.id == assignment_id, DispatchAssignment.provider_user_id == user.id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == assignment.request_id))
    sr = sr_result.scalar_one_or_none()
    if sr:
        old = sr.current_status.value
        sr.current_status = RequestStatus.ARRIVED
        db.add(RequestStatusHistory(
            request_id=sr.id, old_status=old, new_status=RequestStatus.ARRIVED.value,
            changed_by_user_id=user.id, change_source="user", note="Provider arrived",
        ))
    await db.commit()
    return {"message": "Marked as arrived"}


@router.post("/jobs/{assignment_id}/start")
async def start_service(
    assignment_id: int,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DispatchAssignment).where(DispatchAssignment.id == assignment_id, DispatchAssignment.provider_user_id == user.id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == assignment.request_id))
    sr = sr_result.scalar_one_or_none()
    if sr:
        old = sr.current_status.value
        sr.current_status = RequestStatus.IN_SERVICE
        db.add(RequestStatusHistory(
            request_id=sr.id, old_status=old, new_status=RequestStatus.IN_SERVICE.value,
            changed_by_user_id=user.id, change_source="user", note="Service started",
        ))
    await db.commit()
    return {"message": "Service started"}


@router.post("/jobs/{assignment_id}/complete")
async def complete_service(
    assignment_id: int,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DispatchAssignment).where(DispatchAssignment.id == assignment_id, DispatchAssignment.provider_user_id == user.id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    assignment.dispatch_status = DispatchStatus.COMPLETED
    assignment.completed_at = datetime.now(timezone.utc)

    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == assignment.request_id))
    sr = sr_result.scalar_one_or_none()
    if sr:
        old = sr.current_status.value
        sr.current_status = RequestStatus.COMPLETED
        db.add(RequestStatusHistory(
            request_id=sr.id, old_status=old, new_status=RequestStatus.COMPLETED.value,
            changed_by_user_id=user.id, change_source="user", note="Service completed",
        ))
    await db.commit()
    return {"message": "Service completed"}


@router.get("/earnings", response_model=ProviderEarningsOut)
async def get_earnings(
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            func.coalesce(func.sum(ProviderPayout.gross_amount), 0),
            func.coalesce(func.sum(ProviderPayout.commission_amount), 0),
            func.coalesce(func.sum(ProviderPayout.net_amount), 0),
            func.count(ProviderPayout.id),
        ).where(ProviderPayout.provider_user_id == user.id)
    )
    row = result.one()
    return ProviderEarningsOut(
        total_gross=float(row[0]),
        total_commission=float(row[1]),
        total_net=float(row[2]),
        total_jobs=row[3],
    )


@router.post("/location")
async def update_location(
    payload: ProviderLocationUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    loc = ProviderLocation(
        provider_user_id=user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        heading=payload.heading,
        speed=payload.speed,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(loc)
    await db.commit()
    return {"message": "Location updated"}


@router.post("/availability")
async def update_availability(
    payload: ProviderAvailabilityUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderAvailability).where(ProviderAvailability.provider_user_id == user.id))
    avail = result.scalar_one_or_none()
    new_status = ProviderAvailabilityStatus(payload.status)
    if avail:
        avail.status = new_status
        avail.updated_at = datetime.now(timezone.utc)
    else:
        # Need provider profile id
        profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")
        avail = ProviderAvailability(
            provider_user_id=profile.id,
            status=new_status,
        )
        db.add(avail)
    await db.commit()
    return {"message": f"Availability set to {payload.status}"}
