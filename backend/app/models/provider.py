import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Float, Integer, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ProviderType(str, enum.Enum):
    INDIVIDUAL = "individual"
    BUSINESS = "business"


class ProfileStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class ProviderAvailabilityStatus(str, enum.Enum):
    OFFLINE = "offline"
    AVAILABLE = "available"
    BUSY = "busy"
    ON_BREAK = "on_break"
    SUSPENDED = "suspended"


class ProviderTier(str, enum.Enum):
    """Performance-based tier assigned to providers based on jobs completed + average rating."""
    BRONZE = "bronze"      # < 10 jobs OR rating < 3.0
    SILVER = "silver"      # >= 10 jobs AND rating >= 3.0
    GOLD = "gold"          # >= 50 jobs AND rating >= 4.0
    PLATINUM = "platinum"  # >= 200 jobs AND rating >= 4.5


# Multipliers used in dispatch scoring (higher tier → preferred routing)
TIER_MULTIPLIERS: dict[str, float] = {
    ProviderTier.PLATINUM: 1.5,
    ProviderTier.GOLD: 1.3,
    ProviderTier.SILVER: 1.1,
    ProviderTier.BRONZE: 1.0,
}


def compute_tier(jobs_completed: int, average_rating: float) -> ProviderTier:
    """Return the earned tier based on performance metrics."""
    if jobs_completed >= 200 and average_rating >= 4.5:
        return ProviderTier.PLATINUM
    if jobs_completed >= 50 and average_rating >= 4.0:
        return ProviderTier.GOLD
    if jobs_completed >= 10 and average_rating >= 3.0:
        return ProviderTier.SILVER
    return ProviderTier.BRONZE


class ProviderProfile(Base):
    __tablename__ = "provider_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_type: Mapped[ProviderType] = mapped_column(SAEnum(ProviderType), default=ProviderType.INDIVIDUAL)
    phone_secondary: Mapped[str | None] = mapped_column(String(20), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_status: Mapped[ProfileStatus] = mapped_column(SAEnum(ProfileStatus), default=ProfileStatus.PENDING)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_jobs_completed: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[ProviderTier] = mapped_column(SAEnum(ProviderTier), default=ProviderTier.BRONZE)
    max_active_jobs: Mapped[int] = mapped_column(Integer, default=5)
    service_radius_km: Mapped[float] = mapped_column(Float, default=50.0)
    payout_method: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ecocash, bank_transfer
    payout_account_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="provider_profile")
    documents = relationship("ProviderDocument", back_populates="provider", lazy="selectin")
    assets = relationship("ProviderAsset", back_populates="provider", lazy="selectin")
    capabilities = relationship("ProviderServiceCapability", back_populates="provider", lazy="selectin")
    availability = relationship("ProviderAvailability", back_populates="provider", uselist=False, lazy="selectin")


class ProviderDocument(Base):
    __tablename__ = "provider_documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(50))  # id_document, drivers_license, insurance, vehicle_registration
    file_url: Mapped[str] = mapped_column(String(500))
    verification_status: Mapped[str] = mapped_column(String(30), default="pending")  # pending, verified, rejected
    verified_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    provider = relationship("ProviderProfile", back_populates="documents")


class ProviderAsset(Base):
    __tablename__ = "provider_assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id"), index=True)
    asset_type: Mapped[str] = mapped_column(String(50))  # motorcycle, tow_truck, van, tools
    registration_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    capacity_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    provider = relationship("ProviderProfile", back_populates="assets")


class ProviderServiceCapability(Base):
    __tablename__ = "provider_service_capabilities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id"), index=True)
    service_type_id: Mapped[int] = mapped_column(ForeignKey("service_types.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    provider = relationship("ProviderProfile", back_populates="capabilities")
    service_type = relationship("ServiceType", lazy="selectin")


class ProviderLocation(Base):
    __tablename__ = "provider_locations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProviderAvailability(Base):
    __tablename__ = "provider_availability"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id"), unique=True, index=True)
    status: Mapped[ProviderAvailabilityStatus] = mapped_column(
        SAEnum(ProviderAvailabilityStatus), default=ProviderAvailabilityStatus.OFFLINE
    )
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    available_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_job_count: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    provider = relationship("ProviderProfile", back_populates="availability")


class ProviderCoverageZone(Base):
    __tablename__ = "provider_coverage_zones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_user_id: Mapped[int] = mapped_column(ForeignKey("provider_profiles.id"), index=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("pricing_zones.id"), index=True)
    coverage_radius_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
