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
    ProviderLocation, ProviderAvailabilityStatus, ProviderAsset,
    ProviderServiceCapability, ProviderType,
)
from app.models.dispatch import DispatchAssignment, DispatchStatus
from app.models.payment import ProviderPayout
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory
from app.models.service import ServiceType
from app.schemas.provider import (
    ProviderProfileCreate, ProviderProfileUpdate, ProviderProfileOut,
    ProviderLocationUpdate, ProviderAvailabilityUpdate,
    ProviderDocumentCreate, ProviderDocumentOut, ProviderEarningsOut,
    ProviderAssetCreate, ProviderAssetUpdate, ProviderAssetOut,
    ProviderCapabilityUpdate, ProviderCapabilityOut,
)
from app.schemas.request import ServiceRequestOut

router = APIRouter()


async def get_or_create_provider_profile(db: AsyncSession, user: User) -> ProviderProfile:
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    provider_type = ProviderType.INDIVIDUAL
    profile = ProviderProfile(
        user_id=user.id,
        business_name=f"{user.first_name} {user.last_name}".strip() or None,
        provider_type=provider_type,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


def to_profile_out(profile: ProviderProfile) -> ProviderProfileOut:
    availability_status = (
        profile.availability.status.value
        if profile.availability and hasattr(profile.availability.status, "value")
        else (profile.availability.status if profile.availability else "offline")
    )
    return ProviderProfileOut(
        id=profile.id,
        user_id=profile.user_id,
        business_name=profile.business_name,
        provider_type=profile.provider_type.value if hasattr(profile.provider_type, "value") else str(profile.provider_type),
        profile_status=profile.profile_status.value if hasattr(profile.profile_status, "value") else str(profile.profile_status),
        phone_secondary=profile.phone_secondary,
        national_id=profile.national_id,
        license_number=profile.license_number,
        tier=profile.tier.value if hasattr(profile.tier, "value") else str(profile.tier),
        average_rating=profile.average_rating,
        total_jobs_completed=profile.total_jobs_completed,
        max_active_jobs=profile.max_active_jobs,
        service_radius_km=profile.service_radius_km,
        payout_method=profile.payout_method,
        payout_account_reference=profile.payout_account_reference,
        availability_status=availability_status,
        created_at=profile.created_at,
    )


@router.get("/profile", response_model=ProviderProfileOut)
async def get_provider_profile(user: User = Depends(require_provider), db: AsyncSession = Depends(get_db)):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == profile.id))
    profile = result.scalar_one()
    return to_profile_out(profile)


@router.put("/profile", response_model=ProviderProfileOut)
async def update_provider_profile(
    payload: ProviderProfileUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "provider_type" and value is not None:
            value = ProviderType(value)
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return to_profile_out(profile)


@router.get("/assets", response_model=List[ProviderAssetOut])
async def list_provider_assets(
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderAsset).where(ProviderAsset.provider_user_id == profile.id).order_by(ProviderAsset.created_at.desc())
    )
    return [ProviderAssetOut.model_validate(asset) for asset in result.scalars().all()]


@router.post("/assets", response_model=ProviderAssetOut, status_code=status.HTTP_201_CREATED)
async def create_provider_asset(
    payload: ProviderAssetCreate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    asset = ProviderAsset(provider_user_id=profile.id, **payload.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return ProviderAssetOut.model_validate(asset)


@router.put("/assets/{asset_id}", response_model=ProviderAssetOut)
async def update_provider_asset(
    asset_id: int,
    payload: ProviderAssetUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderAsset).where(ProviderAsset.id == asset_id, ProviderAsset.provider_user_id == profile.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await db.commit()
    await db.refresh(asset)
    return ProviderAssetOut.model_validate(asset)


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_asset(
    asset_id: int,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderAsset).where(ProviderAsset.id == asset_id, ProviderAsset.provider_user_id == profile.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await db.delete(asset)
    await db.commit()


@router.get("/documents", response_model=List[ProviderDocumentOut])
async def list_provider_documents(
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderDocument).where(ProviderDocument.provider_user_id == profile.id).order_by(ProviderDocument.created_at.desc())
    )
    return [ProviderDocumentOut.model_validate(doc) for doc in result.scalars().all()]


@router.post("/documents", response_model=ProviderDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    payload: ProviderDocumentCreate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    doc = ProviderDocument(
        provider_user_id=profile.id,
        document_type=payload.document_type,
        file_url=payload.file_url,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return ProviderDocumentOut.model_validate(doc)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderDocument).where(ProviderDocument.id == document_id, ProviderDocument.provider_user_id == profile.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await db.delete(doc)
    await db.commit()


@router.get("/capabilities", response_model=List[ProviderCapabilityOut])
async def list_provider_capabilities(
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(
        select(ProviderServiceCapability, ServiceType)
        .join(ServiceType, ServiceType.id == ProviderServiceCapability.service_type_id)
        .where(ProviderServiceCapability.provider_user_id == profile.id, ProviderServiceCapability.is_active == True)
        .order_by(ServiceType.name)
    )
    items = []
    for capability, service_type in result.all():
        items.append(
            ProviderCapabilityOut(
                id=capability.id,
                service_type_id=service_type.id,
                name=service_type.name,
                code=service_type.code,
                description=service_type.description,
                requires_tow_vehicle=service_type.requires_tow_vehicle,
            )
        )
    return items


@router.put("/capabilities", response_model=List[ProviderCapabilityOut])
async def replace_provider_capabilities(
    payload: ProviderCapabilityUpdate,
    user: User = Depends(require_provider),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_provider_profile(db, user)
    existing_result = await db.execute(
        select(ProviderServiceCapability).where(ProviderServiceCapability.provider_user_id == profile.id)
    )
    existing = existing_result.scalars().all()
    existing_by_type = {item.service_type_id: item for item in existing}
    target_ids = set(payload.service_type_ids)

    for item in existing:
        item.is_active = item.service_type_id in target_ids

    missing_ids = [service_type_id for service_type_id in target_ids if service_type_id not in existing_by_type]
    if missing_ids:
        service_type_result = await db.execute(select(ServiceType).where(ServiceType.id.in_(missing_ids)))
        found_ids = {service_type.id for service_type in service_type_result.scalars().all()}
        missing = set(missing_ids) - found_ids
        if missing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown service type ids: {sorted(missing)}")
        for service_type_id in missing_ids:
            db.add(
                ProviderServiceCapability(
                    provider_user_id=profile.id,
                    service_type_id=service_type_id,
                    is_active=True,
                )
            )

    await db.commit()
    return await list_provider_capabilities(user, db)


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
    profile = await get_or_create_provider_profile(db, user)
    result = await db.execute(select(ProviderAvailability).where(ProviderAvailability.provider_user_id == profile.id))
    avail = result.scalar_one_or_none()
    raw_status = payload.status
    if raw_status is None and payload.is_available is not None:
        raw_status = "available" if payload.is_available else "offline"
    if raw_status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="status is required")
    new_status = ProviderAvailabilityStatus(raw_status)
    if avail:
        avail.status = new_status
        avail.updated_at = datetime.now(timezone.utc)
    else:
        avail = ProviderAvailability(
            provider_user_id=profile.id,
            status=new_status,
        )
        db.add(avail)
    await db.commit()
    return {"message": f"Availability set to {new_status.value}", "status": new_status.value}
