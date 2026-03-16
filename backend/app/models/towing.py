from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class TowingDetail(Base):
    __tablename__ = "towing_details"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), unique=True, index=True)
    tow_type: Mapped[str] = mapped_column(String(50))  # flatbed, wheel_lift, hook_and_chain
    vehicle_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)  # drivable, non_drivable, accident
    destination_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    destination_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    agreed_base_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    agreed_per_km_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_estimated_towing_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class TowingEvent(Base):
    __tablename__ = "towing_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50))  # pickup, in_transit, delivered, incident
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
