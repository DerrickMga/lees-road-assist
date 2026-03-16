from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.notification import Notification
from app.schemas.common import NotificationSend, NotificationOut

router = APIRouter()


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_notification(
    payload: NotificationSend,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    notif = Notification(
        user_id=payload.user_id,
        channel=payload.channel,
        notification_type=payload.notification_type,
        subject=payload.subject,
        body=payload.body,
        status="pending",
        related_request_id=payload.related_request_id,
    )
    db.add(notif)
    await db.commit()
    # TODO: dispatch via Celery to actual channel (SMS, WhatsApp, push, email)
    return {"message": "Notification queued", "id": notif.id}


@router.get("/", response_model=List[NotificationOut])
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]
