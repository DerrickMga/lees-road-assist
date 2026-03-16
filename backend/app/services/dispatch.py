import math
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.provider import (
    ProviderProfile, ProviderLocation, ProviderAvailability,
    ProviderServiceCapability, ProviderAvailabilityStatus, ProfileStatus,
    ProviderTier, TIER_MULTIPLIERS, compute_tier,
)
from app.models.dispatch import DispatchAssignment, DispatchAttempt, DispatchStatus, AssignmentType, ResponseStatus
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_latest_provider_location(db: AsyncSession, provider_user_id: int) -> ProviderLocation | None:
    result = await db.execute(
        select(ProviderLocation)
        .where(ProviderLocation.provider_user_id == provider_user_id)
        .order_by(ProviderLocation.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def find_nearest_providers(
    db: AsyncSession,
    service_type_id: int,
    latitude: float,
    longitude: float,
    max_radius_km: float = 50.0,
    limit: int = 10,
) -> list[dict]:
    """Find nearest available providers that support the requested service type."""
    # Get approved, available providers with the capability
    cap_result = await db.execute(
        select(ProviderServiceCapability).where(
            ProviderServiceCapability.service_type_id == service_type_id,
            ProviderServiceCapability.is_active == True,
        )
    )
    capable_provider_ids = [c.provider_user_id for c in cap_result.scalars().all()]

    if not capable_provider_ids:
        return []

    # Filter by approved profiles
    profile_result = await db.execute(
        select(ProviderProfile).where(
            ProviderProfile.id.in_(capable_provider_ids),
            ProviderProfile.profile_status == ProfileStatus.APPROVED,
        )
    )
    approved_providers = {p.id: p for p in profile_result.scalars().all()}

    if not approved_providers:
        return []

    # Filter by availability
    avail_result = await db.execute(
        select(ProviderAvailability).where(
            ProviderAvailability.provider_user_id.in_(approved_providers.keys()),
            ProviderAvailability.status == ProviderAvailabilityStatus.AVAILABLE,
        )
    )
    available_ids = {a.provider_user_id for a in avail_result.scalars().all()}

    candidates = []
    for pid in available_ids:
        provider = approved_providers.get(pid)
        if not provider:
            continue
        loc = await get_latest_provider_location(db, provider.user_id)
        if not loc:
            continue

        dist = haversine_km(latitude, longitude, loc.latitude, loc.longitude)
        # Respect each provider's own service radius
        provider_radius = getattr(provider, "service_radius_km", max_radius_km)
        if dist > min(max_radius_km, provider_radius):
            continue

        tier = getattr(provider, "tier", ProviderTier.BRONZE)
        tier_mult = TIER_MULTIPLIERS.get(tier, 1.0)
        # Score: closer + higher rating + better tier → higher score
        score = (10.0 / (dist + 0.5)) * ((provider.average_rating / 5.0) + 0.1) * tier_mult

        candidates.append({
            "provider_profile": provider,
            "user_id": provider.user_id,
            "provider_id": provider.id,
            "distance_km": round(dist, 2),
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "average_rating": provider.average_rating,
            "total_jobs_completed": provider.total_jobs_completed,
            "tier": tier.value if hasattr(tier, "value") else str(tier),
            "score": round(score, 4),
        })

    # Sort by score descending; highest quality/nearest first
    candidates.sort(key=lambda x: -x["score"])
    return candidates[:limit]


async def auto_assign_provider(
    db: AsyncSession,
    request: ServiceRequest,
) -> DispatchAssignment | None:
    """Auto-assign the nearest available provider to a service request."""
    candidates = await find_nearest_providers(
        db=db,
        service_type_id=request.service_type_id,
        latitude=request.pickup_latitude,
        longitude=request.pickup_longitude,
    )
    if not candidates:
        return None

    best = candidates[0]
    assignment = DispatchAssignment(
        request_id=request.id,
        provider_user_id=best["user_id"],
        assignment_type=AssignmentType.AUTO,
        dispatch_status=DispatchStatus.PENDING,
    )
    db.add(assignment)

    attempt = DispatchAttempt(
        request_id=request.id,
        provider_user_id=best["user_id"],
        attempt_number=1,
    )
    db.add(attempt)

    # Update request status
    old_status = request.current_status.value if request.current_status else None
    request.current_status = RequestStatus.DISPATCHING
    db.add(RequestStatusHistory(
        request_id=request.id,
        old_status=old_status,
        new_status=RequestStatus.DISPATCHING.value,
        change_source="system",
        note=f"Auto-dispatched to provider #{best['provider_id']}",
    ))

    await db.commit()
    await db.refresh(assignment)
    return assignment


async def record_status_change(
    db: AsyncSession,
    request: ServiceRequest,
    new_status: RequestStatus,
    changed_by_user_id: int | None = None,
    source: str = "system",
    note: str | None = None,
):
    """Record a status change with full audit trail."""
    old_status = request.current_status.value if request.current_status else None
    request.current_status = new_status
    db.add(RequestStatusHistory(
        request_id=request.id,
        old_status=old_status,
        new_status=new_status.value,
        changed_by_user_id=changed_by_user_id,
        change_source=source,
        note=note,
    ))
    await db.flush()


async def refresh_provider_tier(db: AsyncSession, provider: ProviderProfile) -> None:
    """Recompute and save the tier based on current jobs + rating."""
    new_tier = compute_tier(provider.total_jobs_completed, provider.average_rating)
    if provider.tier != new_tier:
        provider.tier = new_tier
        await db.flush()


async def dispatch_to_top_providers(
    db: AsyncSession,
    request: ServiceRequest,
    notify_fn,  # async callable(provider_user_id, assignment, sr) → None
    max_candidates: int = 3,
) -> list[DispatchAssignment]:
    """
    Dispatch a job to the top `max_candidates` scoring providers simultaneously.
    Creates a DispatchAssignment + DispatchAttempt for each.
    The first to accept (via handle_accept_assignment) wins; others are auto-declined.

    `notify_fn` must be an async callable that takes (provider_user_id, assignment, sr)
    and sends the job offer message. Wire this from the route layer to avoid circular imports.
    """
    if request.pickup_latitude is None or request.pickup_longitude is None:
        return []

    candidates = await find_nearest_providers(
        db=db,
        service_type_id=request.service_type_id,
        latitude=request.pickup_latitude,
        longitude=request.pickup_longitude,
        limit=max_candidates,
    )
    if not candidates:
        return []

    assignments = []
    for i, candidate in enumerate(candidates):
        assignment = DispatchAssignment(
            request_id=request.id,
            provider_user_id=candidate["user_id"],
            assignment_type=AssignmentType.AUTO,
            dispatch_status=DispatchStatus.PENDING,
        )
        db.add(assignment)

        attempt = DispatchAttempt(
            request_id=request.id,
            provider_user_id=candidate["user_id"],
            attempt_number=i + 1,
        )
        db.add(attempt)
        assignments.append((assignment, candidate))

    old_status = request.current_status.value if request.current_status else None
    request.current_status = RequestStatus.DISPATCHING
    db.add(RequestStatusHistory(
        request_id=request.id,
        old_status=old_status,
        new_status=RequestStatus.DISPATCHING.value,
        change_source="system",
        note=f"Multi-dispatch to {len(candidates)} provider(s)",
    ))
    await db.commit()

    for assignment, candidate in assignments:
        await db.refresh(assignment)
        try:
            await notify_fn(candidate["user_id"], assignment, request)
        except Exception:
            pass  # Non-fatal; provider may still accept via other channel

    return [a for a, _ in assignments]


async def handle_accept_assignment(
    db: AsyncSession,
    assignment_id: int,
    provider_user_id: int,
    eta_minutes: int | None = None,
) -> tuple[bool, str]:
    """
    Mark the given assignment as ACCEPTED and decline all other pending assignments
    for the same request. Returns (success, message).
    """
    result = await db.execute(
        select(DispatchAssignment).where(
            DispatchAssignment.id == assignment_id,
            DispatchAssignment.provider_user_id == provider_user_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False, "Assignment not found"
    if assignment.dispatch_status != DispatchStatus.PENDING:
        return False, f"Assignment already {assignment.dispatch_status.value}"

    # Accept this one
    assignment.dispatch_status = DispatchStatus.ACCEPTED
    assignment.accepted_at = datetime.now(timezone.utc)
    if eta_minutes:
        assignment.arrival_eta_minutes = eta_minutes

    # Decline all other pending assignments for this request
    others_result = await db.execute(
        select(DispatchAssignment).where(
            DispatchAssignment.request_id == assignment.request_id,
            DispatchAssignment.id != assignment_id,
            DispatchAssignment.dispatch_status == DispatchStatus.PENDING,
        )
    )
    for other in others_result.scalars().all():
        other.dispatch_status = DispatchStatus.DECLINED
        other.declined_at = datetime.now(timezone.utc)
        other.cancellation_reason = "Another provider accepted first"

    # Update request status to DISPATCHING (provider accepted / en route)
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == assignment.request_id))
    sr = sr_result.scalar_one_or_none()
    if sr and sr.current_status not in (RequestStatus.IN_SERVICE, RequestStatus.COMPLETED):
        old = sr.current_status.value
        sr.current_status = RequestStatus.DISPATCHING
        db.add(RequestStatusHistory(
            request_id=sr.id, old_status=old, new_status=RequestStatus.DISPATCHING.value,
            change_source="provider", note=f"Provider #{provider_user_id} accepted",
        ))

    await db.commit()
    return True, "Assignment accepted"


async def handle_decline_assignment(
    db: AsyncSession,
    assignment_id: int,
    provider_user_id: int,
    reason: str = "declined",
) -> tuple[bool, str]:
    """Mark an assignment as DECLINED by the provider."""
    result = await db.execute(
        select(DispatchAssignment).where(
            DispatchAssignment.id == assignment_id,
            DispatchAssignment.provider_user_id == provider_user_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False, "Assignment not found"
    if assignment.dispatch_status != DispatchStatus.PENDING:
        return False, f"Assignment already {assignment.dispatch_status.value}"

    assignment.dispatch_status = DispatchStatus.DECLINED
    assignment.declined_at = datetime.now(timezone.utc)
    assignment.cancellation_reason = reason

    # Update attempt record
    attempt_result = await db.execute(
        select(DispatchAttempt).where(
            DispatchAttempt.request_id == assignment.request_id,
            DispatchAttempt.provider_user_id == provider_user_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if attempt:
        attempt.responded_at = datetime.now(timezone.utc)
        attempt.response_status = ResponseStatus.DECLINED

    await db.commit()
    return True, "Assignment declined"
