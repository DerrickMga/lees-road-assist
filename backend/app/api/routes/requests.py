import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.config import get_settings
from app.api.deps import get_current_user
from app.models.user import User, UserRole, UserStatus
from app.models.request import ServiceRequest, RequestStatus, RequestStatusHistory, ServiceRequestMedia, PriorityLevel
from app.models.service import ServiceType
from app.schemas.request import ServiceRequestCreate, ServiceRequestOut, ServiceRequestCancel, RequestTimelineOut, WhatsAppRequestCreate
from app.services.pricing import calculate_price

router = APIRouter()
settings = get_settings()

# Default coordinates used when none are available (centre of Harare)
_HARARE_LAT = -17.8292
_HARARE_LNG = 31.0522


@router.post("/", response_model=ServiceRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: ServiceRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    priority = PriorityLevel(payload.priority_level) if payload.priority_level in [p.value for p in PriorityLevel] else PriorityLevel.NORMAL
    sr = ServiceRequest(
        uuid=str(uuid.uuid4()),
        customer_user_id=user.id,
        vehicle_id=payload.vehicle_id,
        service_type_id=payload.service_type_id,
        pickup_latitude=payload.pickup_latitude,
        pickup_longitude=payload.pickup_longitude,
        pickup_address=payload.pickup_address,
        destination_latitude=payload.destination_latitude,
        destination_longitude=payload.destination_longitude,
        destination_address=payload.destination_address,
        issue_description=payload.issue_description,
        priority_level=priority,
        channel=payload.channel,
        current_status=RequestStatus.PENDING,
    )
    db.add(sr)
    await db.flush()

    # Calculate and persist estimated price
    pricing = await calculate_price(
        db,
        service_type_id=payload.service_type_id,
        pickup_lat=payload.pickup_latitude,
        pickup_lng=payload.pickup_longitude,
        dest_lat=payload.destination_latitude,
        dest_lng=payload.destination_longitude,
    )
    sr.estimated_price = pricing["total"]
    sr.currency = pricing["currency"]

    # Initial status history
    db.add(RequestStatusHistory(
        request_id=sr.id,
        old_status=None,
        new_status=RequestStatus.PENDING.value,
        changed_by_user_id=user.id,
        change_source="user",
        note="Request created",
    ))
    await db.commit()
    await db.refresh(sr)
    out = ServiceRequestOut.model_validate(sr)
    out.pricing_breakdown = pricing
    return out


@router.post("/whatsapp", response_model=ServiceRequestOut, status_code=status.HTTP_201_CREATED)
async def create_whatsapp_request(
    payload: WhatsAppRequestCreate,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
    db: AsyncSession = Depends(get_db),
):
    """
    Internal endpoint used by the WhatsApp bot to create requests on behalf of
    customers. Authenticated via X-Internal-Key header instead of JWT.
    """
    expected_key = settings.internal_api_key
    if expected_key and x_internal_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")

    # Look up user by phone; auto-create a WhatsApp guest account if needed
    phone = payload.phone.strip()
    user_result = await db.execute(select(User).where(User.phone == phone))
    user = user_result.scalar_one_or_none()
    if not user:
        user = User(
            uuid=__import__("uuid").uuid4(),
            first_name="WhatsApp",
            last_name="Customer",
            phone=phone,
            role=UserRole.CUSTOMER,
            status=UserStatus.ACTIVE,
            is_phone_verified=True,
        )
        db.add(user)
        await db.flush()

    # Look up service type by code/slug
    st_result = await db.execute(
        select(ServiceType).where(ServiceType.code == payload.service_slug)
    )
    service_type = st_result.scalar_one_or_none()
    if not service_type:
        # Fallback: first active service type
        fb = await db.execute(select(ServiceType).where(ServiceType.is_active == True).limit(1))
        service_type = fb.scalar_one_or_none()
    if not service_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown service type")

    sr = ServiceRequest(
        uuid=str(uuid.uuid4()),
        customer_user_id=user.id,
        service_type_id=service_type.id,
        pickup_latitude=_HARARE_LAT,
        pickup_longitude=_HARARE_LNG,
        pickup_address=payload.pickup_address,
        issue_description=payload.issue_description,
        channel=payload.channel,
        priority_level=PriorityLevel.NORMAL,
        current_status=RequestStatus.PENDING,
    )
    db.add(sr)
    await db.flush()

    pricing = await calculate_price(
        db,
        service_type_id=service_type.id,
        pickup_lat=_HARARE_LAT,
        pickup_lng=_HARARE_LNG,
    )
    sr.estimated_price = pricing["total"]
    sr.currency = pricing["currency"]

    db.add(RequestStatusHistory(
        request_id=sr.id,
        old_status=None,
        new_status=RequestStatus.PENDING.value,
        changed_by_user_id=user.id,
        change_source="whatsapp",
        note=f"Request via WhatsApp | payment: {payload.payment_method}",
    ))
    await db.commit()
    await db.refresh(sr)
    out = ServiceRequestOut.model_validate(sr)
    out.service_type_name = service_type.name
    out.pricing_breakdown = pricing
    return out


@router.get("/", response_model=List[ServiceRequestOut])
async def list_requests(
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ServiceRequest).where(ServiceRequest.customer_user_id == user.id)
    if status_filter:
        q = q.where(ServiceRequest.current_status == RequestStatus(status_filter))
    result = await db.execute(q.order_by(ServiceRequest.created_at.desc()))
    out = []
    for r in result.scalars().all():
        item = ServiceRequestOut.model_validate(r)
        item.service_type_name = r.service_type.name if r.service_type else None
        out.append(item)
    return out


@router.get("/{request_uuid}", response_model=ServiceRequestOut)
async def get_request(
    request_uuid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.uuid == request_uuid))
    sr = result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    # Customers can only see their own; admins/providers handled by role checks elsewhere
    if sr.customer_user_id != user.id and user.role.value == "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return ServiceRequestOut.model_validate(sr)


@router.post("/{request_uuid}/cancel")
async def cancel_request(
    request_uuid: str,
    payload: ServiceRequestCancel,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.uuid == request_uuid, ServiceRequest.customer_user_id == user.id))
    sr = result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if sr.current_status in (RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.FAILED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel a completed/cancelled request")

    old = sr.current_status.value
    sr.current_status = RequestStatus.CANCELLED
    db.add(RequestStatusHistory(
        request_id=sr.id,
        old_status=old,
        new_status=RequestStatus.CANCELLED.value,
        changed_by_user_id=user.id,
        change_source="user",
        note=payload.reason,
    ))
    await db.commit()
    return {"message": "Request cancelled"}


@router.get("/{request_uuid}/timeline", response_model=List[RequestTimelineOut])
async def request_timeline(
    request_uuid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(select(ServiceRequest).where(ServiceRequest.uuid == request_uuid))
    sr = sr_result.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if sr.customer_user_id != user.id and user.role.value == "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(
        select(RequestStatusHistory).where(RequestStatusHistory.request_id == sr.id).order_by(RequestStatusHistory.created_at.asc())
    )
    return [RequestTimelineOut.model_validate(h) for h in result.scalars().all()]
