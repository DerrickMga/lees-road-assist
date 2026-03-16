from __future__ import annotations
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    AWAITING_PAYMENT = "awaiting_payment"
    READY_FOR_DISPATCH = "ready_for_dispatch"
    DISPATCHING = "dispatching"
    ASSIGNED = "assigned"
    PROVIDER_EN_ROUTE = "provider_en_route"
    ARRIVED = "arrived"
    IN_SERVICE = "in_service"
    REQUIRES_ESCALATION = "requires_escalation"
    TOWING_IN_PROGRESS = "towing_in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class PriorityLevel(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    EMERGENCY = "emergency"


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, index=True)
    customer_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    service_type_id: Mapped[int] = mapped_column(ForeignKey("service_types.id"), index=True)
    pickup_latitude: Mapped[float] = mapped_column(Float)
    pickup_longitude: Mapped[float] = mapped_column(Float)
    pickup_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    destination_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    issue_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority_level: Mapped[PriorityLevel] = mapped_column(SAEnum(PriorityLevel), default=PriorityLevel.NORMAL)
    channel: Mapped[str] = mapped_column(String(20), default="app")  # app, whatsapp, web, phone
    current_status: Mapped[RequestStatus] = mapped_column(SAEnum(RequestStatus), default=RequestStatus.PENDING)
    estimated_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    customer = relationship("User", lazy="selectin")
    vehicle = relationship("Vehicle", lazy="selectin")
    service_type = relationship("ServiceType", lazy="selectin")
    media = relationship("ServiceRequestMedia", back_populates="request", lazy="selectin")
    status_history = relationship("RequestStatusHistory", back_populates="request", lazy="selectin")
    dispatch_assignments = relationship("DispatchAssignment", back_populates="request", lazy="selectin")


class ServiceRequestMedia(Base):
    __tablename__ = "service_request_media"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    media_type: Mapped[str] = mapped_column(String(20))  # photo, video, audio
    file_url: Mapped[str] = mapped_column(String(500))
    uploaded_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("ServiceRequest", back_populates="media")


class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50))
    changed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    change_source: Mapped[str] = mapped_column(String(30), default="system")  # system, user, admin, bot
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("ServiceRequest", back_populates="status_history")
