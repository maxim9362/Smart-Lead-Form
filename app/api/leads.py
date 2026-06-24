# Exposes endpoints for creating and listing lead records.

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_admin_api_key
from app.schemas.lead import LeadCreate, LeadCreateResponse, LeadListResponse
from app.services.lead_service import create_lead, list_leads

router = APIRouter(prefix="/api/leads", tags=["leads"])

PHONE_ERROR_DETAIL = "Пожалуйста, укажите израильский номер телефона в формате 05XXXXXXXX или +972XXXXXXXXX."


@router.post("", response_model=LeadCreateResponse)
def create_lead_endpoint(payload: LeadCreate, db: Session = Depends(get_db)) -> dict:
    try:
        lead = create_lead(db, payload)
    except ValueError as exc:
        if str(exc) == "Invalid Israeli phone number":
            raise HTTPException(status_code=400, detail=PHONE_ERROR_DETAIL) from exc
        raise

    return {
        "id": lead.id,
        "status": "created",
        "message": "Заявка создана",
    }


@router.get("", response_model=LeadListResponse)
def list_leads_endpoint(
    client_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
) -> dict:
    items, total = list_leads(db, client_id=client_id, limit=limit, offset=offset)
    return {"items": items, "total": total}
