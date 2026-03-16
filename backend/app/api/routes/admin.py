from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import httpx
import logging
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.core.security import hash_password
from app.api.deps import require_admin
from app.models.user import User, UserRole, UserStatus
from app.models.request import ServiceRequest, RequestStatus
from app.models.payment import Transaction, TransactionStatus, ProviderPayout
from app.models.provider import (
    ProviderProfile,
    ProfileStatus,
    ProviderType,
    ProviderTier,
    ProviderAvailability,
    ProviderDocument,
    ProviderAsset,
    ProviderServiceCapability,
    compute_tier,
)
from app.models.dispatch import DispatchAssignment, DispatchStatus, AssignmentType
from app.models.admin import SystemSetting, AdminAction, ComplianceCheck, AnalyticsDailyMetric
from app.schemas.request import ServiceRequestOut

logger = logging.getLogger(__name__)
router = APIRouter()

_WHATSAPP_BOT_URL = "http://localhost:8001"


async def build_provider_performance(profile: ProviderProfile, db: AsyncSession) -> dict:
    assign_result = await db.execute(
        select(
            func.count(DispatchAssignment.id),
            func.count(DispatchAssignment.id).filter(DispatchAssignment.dispatch_status == DispatchStatus.ACCEPTED),
            func.count(DispatchAssignment.id).filter(DispatchAssignment.dispatch_status == DispatchStatus.DECLINED),
            func.count(DispatchAssignment.id).filter(DispatchAssignment.dispatch_status == DispatchStatus.COMPLETED),
            func.count(DispatchAssignment.id).filter(DispatchAssignment.dispatch_status == DispatchStatus.TIMED_OUT),
        ).where(DispatchAssignment.provider_user_id == profile.user_id)
    )
    assignment_row = assign_result.one()
    total_assigned, total_accepted, total_declined, total_completed, total_timed_out = (
        assignment_row[0] or 0,
        assignment_row[1] or 0,
        assignment_row[2] or 0,
        assignment_row[3] or 0,
        assignment_row[4] or 0,
    )

    earnings_result = await db.execute(
        select(
            func.coalesce(func.sum(ProviderPayout.gross_amount), 0),
            func.coalesce(func.sum(ProviderPayout.commission_amount), 0),
            func.coalesce(func.sum(ProviderPayout.net_amount), 0),
            func.count(ProviderPayout.id),
        ).where(ProviderPayout.provider_user_id == profile.user_id)
    )
    earnings_row = earnings_result.one()

    eta_result = await db.execute(
        select(func.avg(DispatchAssignment.arrival_eta_minutes)).where(
            DispatchAssignment.provider_user_id == profile.user_id,
            DispatchAssignment.arrival_eta_minutes.isnot(None),
        )
    )
    avg_eta = eta_result.scalar()

    completion_rate = round((total_completed / total_assigned * 100) if total_assigned > 0 else 0, 1)
    acceptance_rate = round((total_accepted / total_assigned * 100) if total_assigned > 0 else 0, 1)

    return {
        "assignments": {
            "total_assigned": total_assigned,
            "total_accepted": total_accepted,
            "total_declined": total_declined,
            "total_completed": total_completed,
            "total_timed_out": total_timed_out,
            "completion_rate_pct": completion_rate,
            "acceptance_rate_pct": acceptance_rate,
        },
        "earnings": {
            "total_gross": float(earnings_row[0]),
            "total_commission": float(earnings_row[1]),
            "total_net": float(earnings_row[2]),
            "total_payout_records": earnings_row[3],
            "currency": "USD",
        },
        "avg_eta_minutes": round(float(avg_eta), 1) if avg_eta else None,
    }


@router.get("/requests")
async def list_all_requests(
    status_filter: str | None = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(ServiceRequest).order_by(ServiceRequest.created_at.desc())
    if status_filter:
        try:
            q = q.where(ServiceRequest.current_status == RequestStatus(status_filter))
        except ValueError:
            pass
    result = await db.execute(q.limit(min(limit, 500)))
    out = []
    for r in result.scalars().all():
        item = ServiceRequestOut.model_validate(r)
        item.service_type_name = r.service_type.name if r.service_type else None
        out.append(item)
    return out


@router.get("/dashboard/summary")
async def dashboard_summary(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Total users
    user_count = await db.execute(select(func.count(User.id)))
    total_users = user_count.scalar() or 0

    # Active requests
    active_result = await db.execute(
        select(func.count(ServiceRequest.id)).where(
            ServiceRequest.current_status.notin_([
                RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.FAILED
            ])
        )
    )
    active_requests = active_result.scalar() or 0

    # Completed requests
    completed_result = await db.execute(
        select(func.count(ServiceRequest.id)).where(ServiceRequest.current_status == RequestStatus.COMPLETED)
    )
    completed_requests = completed_result.scalar() or 0

    # Total revenue
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.transaction_type == "payment",
            Transaction.status == TransactionStatus.SUCCESSFUL,
        )
    )
    total_revenue = float(revenue_result.scalar() or 0)

    # Provider count
    provider_result = await db.execute(
        select(func.count(User.id)).where(User.role.in_([UserRole.PROVIDER, UserRole.TOW_OPERATOR]))
    )
    total_providers = provider_result.scalar() or 0

    return {
        "total_users": total_users,
        "active_requests": active_requests,
        "completed_requests": completed_requests,
        "total_revenue": round(total_revenue, 2),
        "total_providers": total_providers,
        "currency": "USD",
    }


class AdminCreateUserRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str | None = None
    password: str = Field(min_length=6)
    role: str  # "provider" or "tow_operator"
    business_name: str | None = None
    provider_type: str = "individual"  # "individual" or "business"
    license_number: str | None = None
    national_id: str | None = None


@router.post("/users/create", status_code=201)
async def admin_create_user(
    payload: AdminCreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a provider or tow_operator account with pre-approved profile."""
    allowed_roles = [UserRole.PROVIDER.value, UserRole.TOW_OPERATOR.value]
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {allowed_roles}")

    existing = await db.execute(select(User).where(User.phone == payload.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Phone number already registered")

    if payload.email:
        existing_email = await db.execute(select(User).where(User.email == payload.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole(payload.role),
        status=UserStatus.ACTIVE,
        is_phone_verified=True,
    )
    db.add(user)
    await db.flush()

    ptype = ProviderType.BUSINESS if payload.provider_type == "business" else ProviderType.INDIVIDUAL
    profile = ProviderProfile(
        user_id=user.id,
        business_name=payload.business_name,
        provider_type=ptype,
        license_number=payload.license_number,
        national_id=payload.national_id,
        profile_status=ProfileStatus.APPROVED,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(user)

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role.value,
        "status": user.status.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "credentials": {
            "phone": user.phone,
            "password": payload.password,
        },
    }


@router.get("/users")
async def list_all_users(
    role: str | None = None,
    status_filter: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(User).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == UserRole(role))
    if status_filter:
        q = q.where(User.status == UserStatus(status_filter))
    result = await db.execute(q.limit(200))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "phone": u.phone,
            "email": u.email,
            "role": u.role.value,
            "status": u.status.value,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


class DocumentVerificationRequest(BaseModel):
    status: str


class ComplianceCheckCreateRequest(BaseModel):
    check_type: str
    status: str = "pending"
    notes: str | None = None


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target.status = UserStatus.SUSPENDED
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="suspend_user",
        entity_type="user", entity_id=user_id,
    ))
    await db.commit()
    return {"message": "User suspended"}


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target.status = UserStatus.ACTIVE
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="activate_user",
        entity_type="user", entity_id=user_id,
    ))
    await db.commit()
    return {"message": "User activated"}


@router.get("/providers")
async def list_providers(
    status_filter: str | None = None,
    tier_filter: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(ProviderProfile).order_by(ProviderProfile.created_at.desc())
    if status_filter:
        q = q.where(ProviderProfile.profile_status == ProfileStatus(status_filter))
    if tier_filter:
        q = q.where(ProviderProfile.tier == ProviderTier(tier_filter))
    result = await db.execute(q.limit(200))
    providers = result.scalars().all()

    out = []
    for p in providers:
        avail_result = await db.execute(
            select(ProviderAvailability).where(ProviderAvailability.provider_user_id == p.id)
        )
        avail = avail_result.scalar_one_or_none()

        earnings_result = await db.execute(
            select(
                func.coalesce(func.sum(ProviderPayout.net_amount), 0),
                func.count(ProviderPayout.id),
            ).where(ProviderPayout.provider_user_id == p.user_id)
        )
        earn_row = earnings_result.one()

        out.append({
            "id": p.id,
            "user_id": p.user_id,
            "business_name": p.business_name,
            "provider_type": p.provider_type.value if hasattr(p.provider_type, "value") else p.provider_type,
            "profile_status": p.profile_status.value if hasattr(p.profile_status, "value") else p.profile_status,
            "tier": p.tier.value if hasattr(p.tier, "value") else str(p.tier),
            "average_rating": p.average_rating,
            "total_jobs_completed": p.total_jobs_completed,
            "max_active_jobs": getattr(p, "max_active_jobs", 5),
            "service_radius_km": getattr(p, "service_radius_km", 50.0),
            "availability_status": avail.status.value if avail and hasattr(avail.status, "value") else "offline",
            "total_net_earnings": float(earn_row[0]),
            "total_payouts": earn_row[1],
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return out


@router.get("/providers/{provider_id}")
async def get_provider_detail(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    user_result = await db.execute(select(User).where(User.id == profile.user_id))
    provider_user = user_result.scalar_one_or_none()

    availability_result = await db.execute(
        select(ProviderAvailability).where(ProviderAvailability.provider_user_id == profile.id)
    )
    availability = availability_result.scalar_one_or_none()

    assets_result = await db.execute(
        select(ProviderAsset)
        .where(ProviderAsset.provider_user_id == profile.id)
        .order_by(ProviderAsset.created_at.desc())
    )
    assets = assets_result.scalars().all()

    documents_result = await db.execute(
        select(ProviderDocument)
        .where(ProviderDocument.provider_user_id == profile.id)
        .order_by(ProviderDocument.created_at.desc())
    )
    documents = documents_result.scalars().all()

    capabilities_result = await db.execute(
        select(ProviderServiceCapability, ServiceType)
        .join(ServiceType, ServiceType.id == ProviderServiceCapability.service_type_id)
        .where(ProviderServiceCapability.provider_user_id == profile.id)
        .order_by(ServiceType.name)
    )

    compliance_result = await db.execute(
        select(ComplianceCheck)
        .where(ComplianceCheck.provider_user_id == profile.user_id)
        .order_by(ComplianceCheck.created_at.desc())
    )

    performance = await build_provider_performance(profile, db)

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "business_name": profile.business_name,
        "provider_type": profile.provider_type.value if hasattr(profile.provider_type, "value") else str(profile.provider_type),
        "profile_status": profile.profile_status.value if hasattr(profile.profile_status, "value") else str(profile.profile_status),
        "tier": profile.tier.value if hasattr(profile.tier, "value") else str(profile.tier),
        "average_rating": profile.average_rating,
        "total_jobs_completed": profile.total_jobs_completed,
        "max_active_jobs": getattr(profile, "max_active_jobs", 5),
        "service_radius_km": getattr(profile, "service_radius_km", 50.0),
        "phone_secondary": profile.phone_secondary,
        "national_id": profile.national_id,
        "license_number": profile.license_number,
        "payout_method": profile.payout_method,
        "payout_account_reference": profile.payout_account_reference,
        "availability_status": availability.status.value if availability and hasattr(availability.status, "value") else "offline",
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "user": {
            "id": provider_user.id if provider_user else profile.user_id,
            "first_name": provider_user.first_name if provider_user else None,
            "last_name": provider_user.last_name if provider_user else None,
            "phone": provider_user.phone if provider_user else None,
            "email": provider_user.email if provider_user else None,
            "status": provider_user.status.value if provider_user and hasattr(provider_user.status, "value") else None,
        },
        "assets": [
            {
                "id": asset.id,
                "provider_user_id": asset.provider_user_id,
                "asset_type": asset.asset_type,
                "registration_number": asset.registration_number,
                "make": asset.make,
                "model": asset.model,
                "capacity_notes": asset.capacity_notes,
                "is_active": asset.is_active,
                "created_at": asset.created_at.isoformat() if asset.created_at else None,
            }
            for asset in assets
        ],
        "documents": [
            {
                "id": document.id,
                "provider_user_id": document.provider_user_id,
                "document_type": document.document_type,
                "file_url": document.file_url,
                "verification_status": document.verification_status,
                "verified_by_user_id": document.verified_by_user_id,
                "verified_at": document.verified_at.isoformat() if document.verified_at else None,
                "created_at": document.created_at.isoformat() if document.created_at else None,
            }
            for document in documents
        ],
        "capabilities": [
            {
                "id": capability.id,
                "service_type_id": service_type.id,
                "name": service_type.name,
                "code": service_type.code,
                "description": service_type.description,
                "requires_tow_vehicle": service_type.requires_tow_vehicle,
                "is_active": capability.is_active,
            }
            for capability, service_type in capabilities_result.all()
        ],
        "compliance_checks": [
            {
                "id": check.id,
                "check_type": check.check_type,
                "status": check.status,
                "notes": check.notes,
                "checked_at": check.checked_at.isoformat() if check.checked_at else None,
                "created_at": check.created_at.isoformat() if check.created_at else None,
            }
            for check in compliance_result.scalars().all()
        ],
        **performance,
    }


@router.post("/providers/{provider_id}/approve")
async def approve_provider(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    profile.profile_status = ProfileStatus.APPROVED
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="approve_provider",
        entity_type="provider_profile", entity_id=provider_id,
    ))
    await db.commit()
    return {"message": "Provider approved"}


@router.post("/providers/{provider_id}/documents/{document_id}/verify")
async def verify_provider_document(
    provider_id: int,
    document_id: int,
    payload: DocumentVerificationRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    document_result = await db.execute(
        select(ProviderDocument).where(
            ProviderDocument.id == document_id,
            ProviderDocument.provider_user_id == profile.id,
        )
    )
    document = document_result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if payload.status not in {"pending", "verified", "rejected"}:
        raise HTTPException(status_code=422, detail="status must be pending, verified or rejected")

    document.verification_status = payload.status
    document.verified_by_user_id = admin.id if payload.status in {"verified", "rejected"} else None
    document.verified_at = datetime.now(timezone.utc) if payload.status in {"verified", "rejected"} else None
    db.add(AdminAction(
        admin_user_id=admin.id,
        action_type="verify_provider_document",
        entity_type="provider_document",
        entity_id=document.id,
        metadata_json={"status": payload.status},
    ))
    await db.commit()
    return {"message": "Document status updated", "status": payload.status}


@router.post("/providers/{provider_id}/suspend")
async def suspend_provider(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    profile.profile_status = ProfileStatus.SUSPENDED
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="suspend_provider",
        entity_type="provider_profile", entity_id=provider_id,
    ))
    await db.commit()
    return {"message": "Provider suspended"}


@router.post("/providers/{provider_id}/activate")
async def activate_provider(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Re-approve a previously suspended or rejected provider."""
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    profile.profile_status = ProfileStatus.APPROVED
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="activate_provider",
        entity_type="provider_profile", entity_id=provider_id,
    ))
    await db.commit()
    return {"message": "Provider activated"}


@router.post("/providers/{provider_id}/set-tier")
async def set_provider_tier(
    provider_id: int,
    body: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually override a provider's tier.
    Body: {"tier": "gold"} — accepted values: bronze, silver, gold, platinum.
    Admins can also adjust max_active_jobs and service_radius_km here.
    """
    tier_str = (body.get("tier") or "").lower()
    try:
        new_tier = ProviderTier(tier_str)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid tier '{tier_str}'. Use bronze/silver/gold/platinum")

    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    profile.tier = new_tier
    if "max_active_jobs" in body:
        profile.max_active_jobs = int(body["max_active_jobs"])
    if "service_radius_km" in body:
        profile.service_radius_km = float(body["service_radius_km"])

    db.add(AdminAction(
        admin_user_id=admin.id, action_type="set_provider_tier",
        entity_type="provider_profile", entity_id=provider_id,
    ))
    await db.commit()
    return {"message": f"Provider tier set to {new_tier.value}", "tier": new_tier.value}


@router.post("/providers/{provider_id}/recalculate-tier")
async def recalculate_provider_tier(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Recompute a provider's tier from their current jobs + rating stats."""
    result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    old_tier = profile.tier
    profile.tier = compute_tier(profile.total_jobs_completed, profile.average_rating)
    await db.commit()
    return {
        "message": "Tier recalculated",
        "old_tier": old_tier.value if hasattr(old_tier, "value") else str(old_tier),
        "new_tier": profile.tier.value,
        "jobs_completed": profile.total_jobs_completed,
        "average_rating": profile.average_rating,
    }


@router.post("/providers/{provider_id}/force-assign/{request_id}")
async def force_assign_provider(
    provider_id: int,
    request_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Force-assign a specific provider to a service request, bypassing availability/distance checks.
    Sends job notification via WhatsApp automatically.
    """
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    if profile.profile_status == ProfileStatus.SUSPENDED:
        raise HTTPException(status_code=422, detail="Cannot assign a suspended provider")

    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    from app.models.request import RequestStatusHistory

    assignment = DispatchAssignment(
        request_id=sr.id,
        provider_user_id=profile.user_id,
        assigned_by_user_id=admin.id,
        assignment_type=AssignmentType.MANUAL,
        dispatch_status=DispatchStatus.PENDING,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)
    old = sr.current_status.value
    sr.current_status = RequestStatus.DISPATCHING
    db.add(RequestStatusHistory(
        request_id=sr.id, old_status=old, new_status=RequestStatus.DISPATCHING.value,
        changed_by_user_id=admin.id, change_source="admin", note=f"Force-assigned by admin to provider #{provider_id}",
    ))
    db.add(AdminAction(
        admin_user_id=admin.id, action_type="force_assign_provider",
        entity_type="dispatch_assignment", entity_id=request_id,
    ))
    await db.commit()
    await db.refresh(assignment)

    # Look up provider user phone & notify via WhatsApp
    user_result = await db.execute(select(User).where(User.id == profile.user_id))
    provider_user = user_result.scalar_one_or_none()
    if provider_user and provider_user.phone:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f"{_WHATSAPP_BOT_URL}/notify-provider", json={
                    "provider_phone": provider_user.phone,
                    "assignment_id": str(assignment.id),
                    "request_uuid": str(getattr(sr, "uuid", sr.id)),
                    "service_type_name": getattr(sr.service_type, "name", "Roadside Assistance") if getattr(sr, "service_type", None) else "Roadside Assistance",
                    "pickup_address": sr.pickup_address or "",
                    "issue_description": sr.issue_description or "",
                    "use_template": True,  # Use template to ensure delivery outside 24hr window
                })
        except Exception as exc:
            logger.warning("Force-assign WhatsApp notify failed (non-fatal): %s", exc)

    return {"message": "Provider force-assigned", "assignment_id": assignment.id}


@router.get("/providers/{provider_id}/performance")
async def get_provider_performance(
    provider_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Comprehensive performance dashboard for a single provider.
    Returns: jobs completed/declined, earnings, rating, tier, completion rate, avg response time.
    """
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.id == provider_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    performance = await build_provider_performance(profile, db)

    # Availability status
    avail_result = await db.execute(
        select(ProviderAvailability).where(ProviderAvailability.provider_user_id == profile.id)
    )
    avail = avail_result.scalar_one_or_none()

    return {
        "provider_id": profile.id,
        "user_id": profile.user_id,
        "business_name": profile.business_name,
        "profile_status": profile.profile_status.value,
        "tier": profile.tier.value if hasattr(profile.tier, "value") else str(profile.tier),
        "average_rating": profile.average_rating,
        "total_jobs_completed": profile.total_jobs_completed,
        "availability_status": avail.status.value if avail and hasattr(avail.status, "value") else "offline",
        **performance,
        "max_active_jobs": getattr(profile, "max_active_jobs", 5),
        "service_radius_km": getattr(profile, "service_radius_km", 50.0),
    }


@router.post("/whatsapp/send-template")
async def admin_send_whatsapp_template(
    body: dict,
    admin: User = Depends(require_admin),
):
    """
    Send any approved WABA utility template to a phone number.
    Works OUTSIDE the 24-hour session window.

    Body:
    {
        "to": "+263771234567",
        "template_name": "lra_job_offer",
        "language_code": "en",
        "components": [
            {"type": "body", "parameters": [{"type": "text", "text": "Battery Jump Start"}]}
        ]
    }
    """
    to = (body.get("to") or "").strip()
    template_name = (body.get("template_name") or "").strip()
    if not to or not template_name:
        raise HTTPException(status_code=422, detail="'to' and 'template_name' are required")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_WHATSAPP_BOT_URL}/send-template",
                json={
                    "to": to,
                    "template_name": template_name,
                    "language_code": body.get("language_code", "en"),
                    "components": body.get("components", []),
                },
            )
            resp_data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"WhatsApp bot unreachable: {exc}")

    return {"status": "queued", "to": to, "template": template_name, "bot_response": resp_data}


@router.get("/settings")
async def list_settings(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.setting_key))
    return [
        {"key": s.setting_key, "value": s.setting_value_json}
        for s in result.scalars().all()
    ]


@router.post("/settings/{key}")
async def upsert_setting(
    key: str,
    value: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SystemSetting).where(SystemSetting.setting_key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.setting_value_json = value
    else:
        setting = SystemSetting(setting_key=key, setting_value_json=value)
        db.add(setting)
    await db.commit()
    return {"message": "Setting saved"}


@router.get("/compliance/{provider_user_id}")
async def get_compliance_checks(
    provider_user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ComplianceCheck).where(ComplianceCheck.provider_user_id == provider_user_id).order_by(ComplianceCheck.created_at.desc())
    )
    return [
        {
            "id": c.id,
            "check_type": c.check_type,
            "status": c.status,
            "notes": c.notes,
            "checked_at": c.checked_at.isoformat() if c.checked_at else None,
        }
        for c in result.scalars().all()
    ]


@router.post("/compliance/{provider_user_id}")
async def create_compliance_check(
    provider_user_id: int,
    payload: ComplianceCheckCreateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    compliance_check = ComplianceCheck(
        provider_user_id=provider_user_id,
        check_type=payload.check_type,
        status=payload.status,
        notes=payload.notes,
        checked_by_user_id=admin.id,
        checked_at=datetime.now(timezone.utc) if payload.status != "pending" else None,
    )
    db.add(compliance_check)
    db.add(AdminAction(
        admin_user_id=admin.id,
        action_type="create_compliance_check",
        entity_type="compliance_check",
        entity_id=provider_user_id,
        metadata_json={"check_type": payload.check_type, "status": payload.status},
    ))
    await db.commit()
    await db.refresh(compliance_check)
    return {
        "id": compliance_check.id,
        "check_type": compliance_check.check_type,
        "status": compliance_check.status,
        "notes": compliance_check.notes,
        "checked_at": compliance_check.checked_at.isoformat() if compliance_check.checked_at else None,
    }


@router.get("/analytics/daily")
async def daily_analytics(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalyticsDailyMetric).order_by(AnalyticsDailyMetric.metric_date.desc()).limit(30)
    )
    return [
        {
            "date": m.metric_date,
            "total_requests": m.total_requests,
            "completed_requests": m.completed_requests,
            "cancelled_requests": m.cancelled_requests,
            "total_revenue": m.total_revenue,
            "average_response_minutes": m.average_response_minutes,
        }
        for m in result.scalars().all()
    ]
