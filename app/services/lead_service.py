# Validates lead data, persists lead records, and triggers notification stubs.

import logging

from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.schemas.lead import LeadCreate
from app.services.email_service import notify_owner_about_new_lead
from app.services.phone_validator import normalize_israeli_phone


logger = logging.getLogger(__name__)
ALLOWED_LEAD_STATUSES = {"new", "in_progress", "done", "cancelled"}


def create_lead(db: Session, lead_data: LeadCreate) -> Lead:
    """Create a lead after normalizing and validating its phone number."""
    normalized_phone = normalize_israeli_phone(lead_data.phone)

    if normalized_phone is None:
        raise ValueError("Invalid Israeli phone number")

    lead = Lead(
        client_id=lead_data.client_id,
        scenario_key=lead_data.scenario_key,
        service_type=lead_data.service_type,
        language_pair=lead_data.language_pair,
        page_count=lead_data.page_count,
        urgency=lead_data.urgency,
        meeting_format=lead_data.meeting_format,
        city=lead_data.city,
        documents_ready=lead_data.documents_ready,
        name=lead_data.name,
        phone=normalized_phone,
        email=lead_data.email,
        preferred_contact_time=lead_data.preferred_contact_time,
        comment=lead_data.comment,
        estimated_price_min=lead_data.estimated_price_min,
        estimated_price_max=lead_data.estimated_price_max,
        currency=lead_data.currency,
        estimate_message=lead_data.estimate_message,
        disclaimer=lead_data.disclaimer,
        answers_json=lead_data.answers,
        status="new",
    )

    db.add(lead)
    db.commit()
    db.refresh(lead)

    try:
        notify_owner_about_new_lead(lead)
    except Exception:
        logger.exception("Failed to send owner notification stub")

    return lead


def list_leads(
    db: Session,
    client_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Lead], int]:
    """List leads, optionally filtered by client_id, with total count."""
    query = db.query(Lead)

    if client_id:
        query = query.filter(Lead.client_id == client_id)

    total = query.count()
    items = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()

    return items, total


def get_lead(db: Session, lead_id: int) -> Lead | None:
    return db.query(Lead).filter(Lead.id == lead_id).first()


def update_lead_status(db: Session, lead_id: int, status: str) -> Lead:
    if status not in ALLOWED_LEAD_STATUSES:
        raise ValueError("Invalid lead status")

    lead = get_lead(db, lead_id)
    if lead is None:
        raise LookupError("Lead not found")

    lead.status = status
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(db: Session, lead_id: int) -> None:
    lead = get_lead(db, lead_id)
    if lead is None:
        raise LookupError("Lead not found")

    db.delete(lead)
    db.commit()
