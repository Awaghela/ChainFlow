from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.rules import validation_v2 as validator

router = APIRouter(tags=["records"])


def _upsert(db: Session, model_cls, natural_key_field: str, natural_key_value, payload: dict):
    existing = db.query(model_cls).filter(getattr(model_cls, natural_key_field) == natural_key_value).first()
    missing = validator.check_record(payload)
    fields = {k: v for k, v in payload.items() if k in model_cls.__table__.columns.keys()}
    fields["missing_fields"] = missing
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing, missing
    obj = model_cls(**fields)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj, missing


@router.post("/purchase-orders")
def ingest_po(payload: dict, db: Session = Depends(get_db)):
    payload = {**payload, "record_type": "purchase_order"}
    obj, missing = _upsert(db, models.PurchaseOrder, "po_number", payload.get("po_number"), payload)
    return {"id": obj.id, "po_number": obj.po_number, "missing_fields": missing}


@router.get("/purchase-orders")
def list_pos(db: Session = Depends(get_db), limit: int = 200):
    rows = db.query(models.PurchaseOrder).limit(limit).all()
    return [
        {"id": r.id, "po_number": r.po_number, "supplier_id": r.supplier_id,
         "requested_delivery_date": r.requested_delivery_date, "cost_center": r.cost_center,
         "missing_fields": r.missing_fields or []}
        for r in rows
    ]


@router.post("/shipments")
def ingest_shipment(payload: dict, db: Session = Depends(get_db)):
    payload = {**payload, "record_type": "shipment_update"}
    obj, missing = _upsert(db, models.Shipment, "shipment_id", payload.get("shipment_id"), payload)
    return {"id": obj.id, "shipment_id": obj.shipment_id, "missing_fields": missing}


@router.get("/shipments")
def list_shipments(db: Session = Depends(get_db), limit: int = 200):
    rows = db.query(models.Shipment).limit(limit).all()
    return [
        {"id": r.id, "shipment_id": r.shipment_id, "po_number": r.po_number, "carrier": r.carrier,
         "status": r.status, "eta": r.eta, "missing_fields": r.missing_fields or []}
        for r in rows
    ]


@router.post("/inventory-changes")
def ingest_inventory(payload: dict, db: Session = Depends(get_db)):
    payload = {**payload, "record_type": "inventory_change"}
    obj, missing = _upsert(db, models.InventoryChangeRecord, "id", payload.get("id"), payload)
    return {"id": obj.id, "sku": obj.sku, "missing_fields": missing}


@router.get("/inventory-changes")
def list_inventory(db: Session = Depends(get_db), limit: int = 200):
    rows = db.query(models.InventoryChangeRecord).limit(limit).all()
    return [
        {"id": r.id, "sku": r.sku, "warehouse_id": r.warehouse_id, "change_type": r.change_type,
         "quantity_delta": r.quantity_delta, "missing_fields": r.missing_fields or []}
        for r in rows
    ]


@router.post("/supplier-emails")
def ingest_email(payload: dict, db: Session = Depends(get_db)):
    payload = {**payload, "record_type": "supplier_email"}
    obj, missing = _upsert(db, models.SupplierEmailRecord, "id", payload.get("id"), payload)
    return {"id": obj.id, "sender": obj.sender, "missing_fields": missing}


@router.get("/supplier-emails")
def list_emails(db: Session = Depends(get_db), limit: int = 200):
    rows = db.query(models.SupplierEmailRecord).limit(limit).all()
    return [
        {"id": r.id, "sender": r.sender, "subject": r.subject, "referenced_po_number": r.referenced_po_number,
         "promised_date": r.promised_date, "requested_action": r.requested_action, "body": r.body,
         "missing_fields": r.missing_fields or []}
        for r in rows
    ]
