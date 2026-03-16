from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.tracking import LiveTrackingSession, ETALog
from app.services.dispatch import haversine_km

router = APIRouter()


@router.get("/{request_id}")
async def get_tracking(
    request_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LiveTrackingSession).where(
            LiveTrackingSession.request_id == request_id,
            LiveTrackingSession.tracking_status == "active",
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active tracking session")

    # Get latest provider location
    from app.models.provider import ProviderLocation
    loc_result = await db.execute(
        select(ProviderLocation)
        .where(ProviderLocation.provider_user_id == session.provider_user_id)
        .order_by(ProviderLocation.recorded_at.desc()).limit(1)
    )
    loc = loc_result.scalar_one_or_none()

    return {
        "session_id": session.id,
        "request_id": session.request_id,
        "provider_user_id": session.provider_user_id,
        "status": session.tracking_status,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "provider_location": {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "heading": loc.heading,
            "speed": loc.speed,
            "recorded_at": loc.recorded_at.isoformat(),
        } if loc else None,
    }


@router.post("/{request_id}/heartbeat")
async def tracking_heartbeat(
    request_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Provider sends periodic location updates for an active tracking session."""
    result = await db.execute(
        select(LiveTrackingSession).where(
            LiveTrackingSession.request_id == request_id,
            LiveTrackingSession.provider_user_id == user.id,
            LiveTrackingSession.tracking_status == "active",
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active tracking session")
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Heartbeat received"}


@router.get("/{request_id}/eta")
async def get_eta(
    request_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ETALog).where(ETALog.request_id == request_id).order_by(ETALog.calculated_at.desc()).limit(1)
    )
    eta = result.scalar_one_or_none()
    if not eta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ETA available")
    return {
        "request_id": eta.request_id,
        "estimated_minutes": eta.estimated_minutes,
        "calculated_at": eta.calculated_at.isoformat(),
        "source": eta.source,
    }
