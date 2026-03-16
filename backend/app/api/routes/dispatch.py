from datetime import datetime, timezone
import asyncio
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.dispatch import DispatchAssignment, DispatchAttempt, DispatchStatus, AssignmentType, ResponseStatus
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory
from app.models.provider import ProviderProfile
from app.schemas.dispatch import (
    DispatchAssignRequest, DispatchReassignRequest, DispatchAssignmentOut, NearbyProviderOut,
)
from app.services.dispatch import (
    find_nearest_providers, auto_assign_provider,
    dispatch_to_top_providers, handle_accept_assignment, handle_decline_assignment,
    refresh_provider_tier,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_WHATSAPP_BOT_URL = "http://localhost:8001"


async def _notify_provider_whatsapp(
    db: AsyncSession,
    assignment: DispatchAssignment,
    sr: ServiceRequest,
    use_template: bool = False,
) -> None:
    """Fire-and-forget: send a job notification to a provider via WhatsApp."""
    try:
        provider_result = await db.execute(
            select(User).where(User.id == assignment.provider_user_id)
        )
        provider_user = provider_result.scalar_one_or_none()
        if not provider_user or not provider_user.phone:
            logger.warning("Provider %s has no phone — skipping WhatsApp notify", assignment.provider_user_id)
            return

        payload = {
            "provider_phone":    provider_user.phone,
            "assignment_id":     str(assignment.id),
            "request_uuid":      str(getattr(sr, "uuid", sr.id)),
            "service_type_name": getattr(sr.service_type, "name", "Roadside Assistance") if getattr(sr, "service_type", None) else "Roadside Assistance",
            "pickup_address":    sr.pickup_address or "",
            "issue_description": sr.issue_description or "",
            "payment_method":    "cash",
            "vehicle_info":      "",
            "use_template":      use_template,  # template bypasses 24-hour window
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{_WHATSAPP_BOT_URL}/notify-provider", json=payload)
            if resp.status_code not in (200, 201):
                logger.warning("WhatsApp notify-provider returned %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("WhatsApp provider notify failed (non-fatal): %s", exc)


@router.post("/assign", response_model=DispatchAssignmentOut)
async def assign_dispatch(
    payload: DispatchAssignRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == payload.request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if payload.provider_user_id:
        # Manual assignment
        assignment = DispatchAssignment(
            request_id=sr.id,
            provider_user_id=payload.provider_user_id,
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
            changed_by_user_id=admin.id, change_source="admin", note="Manual dispatch",
        ))
        await db.commit()
        await db.refresh(assignment)
        asyncio.create_task(_notify_provider_whatsapp(db, assignment, sr, use_template=True))
        return DispatchAssignmentOut.model_validate(assignment)
    else:
        # Auto-assign (single best candidate)
        assignment = await auto_assign_provider(db, sr)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No available providers found")
        asyncio.create_task(_notify_provider_whatsapp(db, assignment, sr, use_template=True))
        return DispatchAssignmentOut.model_validate(assignment)


@router.post("/multi-dispatch/{request_id}")
async def multi_dispatch(
    request_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatch a job to the top 3 nearest/best-scoring providers simultaneously.
    The first to accept wins; all others are automatically declined.
    Uses WABA utility templates so it works outside the 24-hour session window.
    """
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")

    async def _notify(provider_user_id: int, assignment: DispatchAssignment, sr: ServiceRequest):
        await _notify_provider_whatsapp(db, assignment, sr, use_template=True)

    assignments = await dispatch_to_top_providers(db, sr, notify_fn=_notify, max_candidates=3)
    if not assignments:
        raise HTTPException(status_code=404, detail="No available providers found in range")

    return {
        "message": f"Job dispatched to {len(assignments)} provider(s)",
        "assignment_ids": [a.id for a in assignments],
        "request_id": request_id,
    }


@router.post("/{assignment_id}/reassign")
async def reassign_dispatch(
    assignment_id: int,
    payload: DispatchReassignRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DispatchAssignment).where(DispatchAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    assignment.dispatch_status = DispatchStatus.CANCELLED
    assignment.cancellation_reason = payload.reason or "Reassigned by admin"

    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == assignment.request_id))
    sr = sr_result.scalar_one_or_none()
    if sr:
        new_assignment = await auto_assign_provider(db, sr)
        if not new_assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No alternative providers found")
        await db.commit()
        asyncio.create_task(_notify_provider_whatsapp(db, new_assignment, sr, use_template=True))
        return {"message": "Reassigned", "new_assignment_id": new_assignment.id}

    await db.commit()
    return {"message": "Original cancelled, no request found for re-assign"}


@router.post("/jobs/{assignment_id}/accept")
async def accept_job(
    assignment_id: int,
    body: dict = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Provider accepts a job. Automatically declines all other pending assignments
    for the same request (first-accept-wins when multi-dispatched).
    """
    eta_minutes = (body or {}).get("eta_minutes")
    success, message = await handle_accept_assignment(db, assignment_id, user.id, eta_minutes)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Refresh tier after accepting (will update after completion)
    profile_result = await db.execute(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    if profile:
        await refresh_provider_tier(db, profile)
        await db.commit()

    return {"message": "Job accepted"}


@router.post("/jobs/{assignment_id}/decline")
async def decline_job(
    assignment_id: int,
    body: dict = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Provider declines a job offer."""
    reason = (body or {}).get("reason", "declined")
    success, message = await handle_decline_assignment(db, assignment_id, user.id, reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": "Job declined"}


@router.post("/jobs/{assignment_id}/timeout")
async def timeout_assignment(
    assignment_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark an assignment as TIMED_OUT (provider didn't respond within the window).
    Can be called by a background task scheduler after 10 minutes.
    """
    result = await db.execute(select(DispatchAssignment).where(DispatchAssignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.dispatch_status != DispatchStatus.PENDING:
        return {"message": f"Assignment already {assignment.dispatch_status.value} — no action taken"}

    assignment.dispatch_status = DispatchStatus.TIMED_OUT
    assignment.cancellation_reason = "Provider did not respond within time limit"

    # Update attempt record
    attempt_result = await db.execute(
        select(DispatchAttempt).where(
            DispatchAttempt.request_id == assignment.request_id,
            DispatchAttempt.provider_user_id == assignment.provider_user_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if attempt:
        attempt.responded_at = datetime.now(timezone.utc)
        attempt.response_status = ResponseStatus.TIMED_OUT

    await db.commit()
    return {"message": "Assignment timed out", "assignment_id": assignment_id}


@router.get("/board", response_model=List[DispatchAssignmentOut])
async def dispatch_board(
    status_filter: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(DispatchAssignment).order_by(DispatchAssignment.assigned_at.desc())
    if status_filter:
        q = q.where(DispatchAssignment.dispatch_status == DispatchStatus(status_filter))
    result = await db.execute(q.limit(100))
    return [DispatchAssignmentOut.model_validate(a) for a in result.scalars().all()]


@router.get("/nearby-providers", response_model=List[NearbyProviderOut])
async def nearby_providers(
    service_type_id: int,
    latitude: float,
    longitude: float,
    radius_km: float = 50.0,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    providers = await find_nearest_providers(db, service_type_id, latitude, longitude, radius_km)
    results = []
    for p in providers:
        profile = p["provider_profile"]
        from app.models.user import User as UserModel
        user_result = await db.execute(select(UserModel).where(UserModel.id == p["user_id"]))
        u = user_result.scalar_one_or_none()
        results.append(NearbyProviderOut(
            user_id=p["user_id"],
            provider_id=p["provider_id"],
            first_name=u.first_name if u else "",
            last_name=u.last_name if u else "",
            distance_km=p["distance_km"],
            average_rating=p["average_rating"],
            total_jobs_completed=p["total_jobs_completed"],
            tier=p.get("tier", "bronze"),
            score=p.get("score", 0.0),
        ))
    return results
