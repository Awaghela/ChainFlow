from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.rules import validation_v2 as validator
from app.services import llm

router = APIRouter(prefix="/exceptions", tags=["exceptions"])

VALID_TRANSITIONS = {
    "start_review": {"from": ["pending"], "to": "in_review"},
    "approve": {"from": ["pending", "in_review"], "to": "approved"},
    "reject": {"from": ["pending", "in_review"], "to": "rejected"},
    "escalate": {"from": ["pending", "in_review"], "to": "escalated"},
}


def _log(db: Session, exc: models.DeliveryExceptionRecord, actor: str, action: str,
         prev: str | None, new: str | None, note: str | None = None):
    entry = models.AuditLog(
        exception_pk=exc.id, actor=actor, action=action,
        previous_state=prev, new_state=new, note=note,
    )
    db.add(entry)
    db.commit()


def _gather_context(db: Session, exc: models.DeliveryExceptionRecord) -> dict:
    po = None
    if exc.po_number:
        p = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.po_number == exc.po_number).first()
        if p:
            po = {"po_number": p.po_number, "supplier_id": p.supplier_id,
                  "requested_delivery_date": p.requested_delivery_date, "cost_center": p.cost_center}
    shipment = None
    if exc.shipment_id:
        s = db.query(models.Shipment).filter(models.Shipment.shipment_id == exc.shipment_id).first()
        if s:
            shipment = {"shipment_id": s.shipment_id, "carrier": s.carrier, "status": s.status,
                        "eta": s.eta, "destination": s.destination}
    emails = []
    if exc.po_number:
        rows = (db.query(models.SupplierEmailRecord)
                .filter(models.SupplierEmailRecord.referenced_po_number == exc.po_number).limit(3).all())
        emails = [{"subject": e.subject, "body": e.body, "promised_date": e.promised_date} for e in rows]

    return {
        "exception": {
            "exception_id": exc.exception_id, "exception_type": exc.exception_type,
            "severity": exc.severity, "description": exc.description, "po_number": exc.po_number,
            "shipment_id": exc.shipment_id, "related_sku": exc.related_sku,
            "missing_fields": exc.missing_fields or [],
        },
        "related": {"purchase_order": po, "shipment": shipment, "supplier_emails": emails},
    }


@router.post("")
def ingest_exception(payload: dict, db: Session = Depends(get_db)):
    payload = {**payload, "record_type": "delivery_exception"}
    missing = validator.check_record(payload)
    existing = db.query(models.DeliveryExceptionRecord).filter(
        models.DeliveryExceptionRecord.exception_id == payload.get("exception_id")).first()
    fields = {k: v for k, v in payload.items()
              if k in models.DeliveryExceptionRecord.__table__.columns.keys()}
    fields["missing_fields"] = missing
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        obj = existing
    else:
        obj = models.DeliveryExceptionRecord(**fields)
        db.add(obj)
    db.commit()
    db.refresh(obj)
    _log(db, obj, "system", "ingested", None, obj.review_state.value if hasattr(obj.review_state, "value") else obj.review_state)
    return {"id": obj.id, "exception_id": obj.exception_id, "missing_fields": missing}


@router.get("", response_model=list[schemas.ExceptionOut])
def list_exceptions(db: Session = Depends(get_db), state: str | None = None, limit: int = 200):
    q = db.query(models.DeliveryExceptionRecord)
    if state:
        q = q.filter(models.DeliveryExceptionRecord.review_state == state)
    rows = q.order_by(models.DeliveryExceptionRecord.created_at.desc()).limit(limit).all()
    return rows


@router.get("/{exception_id}", response_model=schemas.ExceptionOut)
def get_exception(exception_id: str, db: Session = Depends(get_db)):
    obj = db.query(models.DeliveryExceptionRecord).filter(
        models.DeliveryExceptionRecord.exception_id == exception_id).first()
    if not obj:
        raise HTTPException(404, "Exception not found")
    return obj


@router.post("/{exception_id}/summarize", response_model=schemas.ExceptionOut)
def summarize_exception(exception_id: str, db: Session = Depends(get_db)):
    obj = db.query(models.DeliveryExceptionRecord).filter(
        models.DeliveryExceptionRecord.exception_id == exception_id).first()
    if not obj:
        raise HTTPException(404, "Exception not found")

    context = _gather_context(db, obj)
    result = llm.generate_triage_brief(context)

    obj.ai_summary = result["summary"]
    obj.ai_suggested_action = result["suggested_action"]
    obj.ai_confidence = result.get("confidence")
    obj.ai_generated_at = datetime.utcnow()
    obj.ai_cache_hit = 1 if result.get("cache_hit") else 0
    db.commit()
    db.refresh(obj)

    _log(db, obj, "system", "ai_summary_generated", None, None,
         note=f"source={result.get('source')} cache_hit={result.get('cache_hit')}")
    return obj


@router.post("/{exception_id}/review", response_model=schemas.ExceptionOut)
def review_exception(exception_id: str, action: schemas.ReviewAction, db: Session = Depends(get_db)):
    obj = db.query(models.DeliveryExceptionRecord).filter(
        models.DeliveryExceptionRecord.exception_id == exception_id).first()
    if not obj:
        raise HTTPException(404, "Exception not found")

    transition = VALID_TRANSITIONS.get(action.action)
    if not transition:
        raise HTTPException(400, f"Unknown action '{action.action}'")
    current = obj.review_state.value if hasattr(obj.review_state, "value") else obj.review_state
    if current not in transition["from"]:
        raise HTTPException(409, f"Cannot '{action.action}' an exception in state '{current}'")

    prev = current
    obj.review_state = transition["to"]
    obj.reviewed_by = action.actor
    obj.reviewed_at = datetime.utcnow()
    obj.review_note = action.note
    db.commit()
    db.refresh(obj)

    _log(db, obj, action.actor, "state_changed", prev, transition["to"], note=action.note)
    return obj


@router.get("/{exception_id}/audit", response_model=list[schemas.AuditLogOut])
def get_audit_log(exception_id: str, db: Session = Depends(get_db)):
    obj = db.query(models.DeliveryExceptionRecord).filter(
        models.DeliveryExceptionRecord.exception_id == exception_id).first()
    if not obj:
        raise HTTPException(404, "Exception not found")
    rows = (db.query(models.AuditLog).filter(models.AuditLog.exception_pk == obj.id)
            .order_by(models.AuditLog.timestamp.asc()).all())
    return rows
