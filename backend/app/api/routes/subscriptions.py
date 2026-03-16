from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.subscription import SubscriptionPlan, Subscription, SubscriptionUsage
from app.schemas.common import SubscriptionPlanOut, SubscribeRequest, SubscriptionOut

router = APIRouter()


@router.get("/plans", response_model=List[SubscriptionPlanOut])
async def list_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True).order_by(SubscriptionPlan.price))
    return [SubscriptionPlanOut.model_validate(p) for p in result.scalars().all()]


@router.post("/subscribe", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for active subscription
    existing = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.status == "active")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have an active subscription")

    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id, SubscriptionPlan.is_active == True))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    now = datetime.now(timezone.utc)
    duration = timedelta(days=365) if plan.billing_cycle == "annual" else timedelta(days=30)

    sub = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status="active",
        start_at=now,
        end_at=now + duration,
        auto_renew=True,
        next_billing_at=now + duration,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return SubscriptionOut.model_validate(sub)


@router.get("/current", response_model=SubscriptionOut)
async def current_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.status == "active")
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active subscription")
    return SubscriptionOut.model_validate(sub)


@router.post("/cancel")
async def cancel_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.status == "active")
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active subscription")
    sub.status = "cancelled"
    sub.auto_renew = False
    await db.commit()
    return {"message": "Subscription cancelled"}
