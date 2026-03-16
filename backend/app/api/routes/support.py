from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_support
from app.models.user import User
from app.models.support import SupportTicket, TicketMessage, Incident
from app.schemas.common import (
    SupportTicketCreate, SupportTicketOut,
    TicketMessageCreate, TicketMessageOut,
    IncidentCreate,
)

router = APIRouter()


@router.post("/tickets", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: SupportTicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = SupportTicket(
        request_id=payload.request_id,
        customer_user_id=user.id if user.role.value == "customer" else None,
        provider_user_id=user.id if user.role.value in ("provider", "tow_operator") else None,
        category=payload.category,
        priority=payload.priority,
        status="open",
        subject=payload.subject,
        description=payload.description,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return SupportTicketOut.model_validate(ticket)


@router.get("/tickets", response_model=List[SupportTicketOut])
async def list_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value in ("admin", "super_admin", "support_agent"):
        result = await db.execute(select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(100))
    else:
        result = await db.execute(
            select(SupportTicket).where(
                (SupportTicket.customer_user_id == user.id) | (SupportTicket.provider_user_id == user.id)
            ).order_by(SupportTicket.created_at.desc())
        )
    return [SupportTicketOut.model_validate(t) for t in result.scalars().all()]


@router.get("/tickets/{ticket_id}", response_model=SupportTicketOut)
async def get_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    # Access check: owner or support staff
    if user.role.value not in ("admin", "super_admin", "support_agent"):
        if ticket.customer_user_id != user.id and ticket.provider_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return SupportTicketOut.model_validate(ticket)


@router.post("/tickets/{ticket_id}/message", response_model=TicketMessageOut, status_code=status.HTTP_201_CREATED)
async def add_ticket_message(
    ticket_id: int,
    payload: TicketMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    msg = TicketMessage(
        ticket_id=ticket_id,
        sender_user_id=user.id,
        message_body=payload.message_body,
        is_internal_note=payload.is_internal_note,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return TicketMessageOut.model_validate(msg)


@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageOut])
async def list_ticket_messages(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at.asc())
    )
    messages = result.scalars().all()
    # Hide internal notes from non-staff
    if user.role.value not in ("admin", "super_admin", "support_agent"):
        messages = [m for m in messages if not m.is_internal_note]
    return [TicketMessageOut.model_validate(m) for m in messages]


@router.post("/incidents/report", status_code=status.HTTP_201_CREATED)
async def report_incident(
    payload: IncidentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    incident = Incident(
        request_id=payload.request_id,
        incident_type=payload.incident_type,
        severity=payload.severity,
        description=payload.description,
        reported_by_user_id=user.id,
        resolution_status="open",
    )
    db.add(incident)
    await db.commit()
    return {"message": "Incident reported", "id": incident.id}
