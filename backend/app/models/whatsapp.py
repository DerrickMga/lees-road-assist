from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    session_status: Mapped[str] = mapped_column(String(20), default="active")  # active, closed, handoff
    current_flow: Mapped[str | None] = mapped_column(String(50), nullable=True)  # greeting, choose_service, collect_location, etc.
    current_step: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_support_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    messages = relationship("WhatsAppMessage", back_populates="conversation", lazy="selectin")
    state_payloads = relationship("BotStatePayload", back_populates="conversation", lazy="selectin")


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("whatsapp_conversations.id"), index=True)
    direction: Mapped[str] = mapped_column(String(10))  # inbound, outbound
    message_type: Mapped[str] = mapped_column(String(20))  # text, location, image, interactive, template
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sent_status: Mapped[str] = mapped_column(String(20), default="sent")  # sent, delivered, read, failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    conversation = relationship("WhatsAppConversation", back_populates="messages")


class BotStatePayload(Base):
    __tablename__ = "bot_state_payloads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("whatsapp_conversations.id"), index=True)
    state_key: Mapped[str] = mapped_column(String(50))
    state_value_json: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    conversation = relationship("WhatsAppConversation", back_populates="state_payloads")
