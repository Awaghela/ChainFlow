import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.rules import validation_v2 as validator
from app.services import cache

router = APIRouter(tags=["seed"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MODEL_BY_TYPE = {
    "purchase_order": (models.PurchaseOrder, "po_number"),
    "shipment_update": (models.Shipment, "shipment_id"),
    "inventory_change": (models.InventoryChangeRecord, "id"),
    "supplier_email": (models.SupplierEmailRecord, "id"),
    "delivery_exception": (models.DeliveryExceptionRecord, "exception_id"),
}


@router.post("/seed/load")
def load_seed(db: Session = Depends(get_db), reset: bool = True):
    with open(DATA_DIR / "seed_dataset.json") as f:
        dataset = json.load(f)

    if reset:
        # AuditLog rows carry a foreign key to delivery_exceptions, so they
        # must be deleted first -- SQLite doesn't enforce this by default
        # (which is why this bug didn't show up in local/SQLite testing),
        # but Postgres correctly rejects the delete otherwise.
        db.query(models.AuditLog).delete()
        for model_cls, _ in MODEL_BY_TYPE.values():
            db.query(model_cls).delete()
        db.commit()

    counts = {k: 0 for k in MODEL_BY_TYPE}
    for rec in dataset["records"]:
        rtype = rec["record_type"]
        model_cls, key_field = MODEL_BY_TYPE[rtype]
        missing = validator.check_record(rec)
        fields = {k: v for k, v in rec.items() if k in model_cls.__table__.columns.keys()}
        fields["missing_fields"] = missing
        obj = model_cls(**fields)
        db.add(obj)
        counts[rtype] += 1
    db.commit()

    return {
        "loaded": counts,
        "total": sum(counts.values()),
    }


@router.delete("/records/all")
def wipe_all_records(db: Session = Depends(get_db)):
    """Clears every record and audit entry in the workspace. Used by the
    'Clear all workspace data' action in Settings — does not touch the
    company name."""
    # Same ordering fix as load_seed: AuditLog references delivery_exceptions,
    # so it must go first.
    audit_deleted = db.query(models.AuditLog).delete()
    counts = {}
    for rtype, (model_cls, _) in MODEL_BY_TYPE.items():
        counts[rtype] = db.query(model_cls).delete()
    db.commit()
    return {"cleared": counts, "audit_entries_cleared": audit_deleted}


@router.get("/seed/status")
def seed_status(db: Session = Depends(get_db)):
    return {
        "purchase_orders": db.query(models.PurchaseOrder).count(),
        "shipments": db.query(models.Shipment).count(),
        "inventory_changes": db.query(models.InventoryChangeRecord).count(),
        "supplier_emails": db.query(models.SupplierEmailRecord).count(),
        "delivery_exceptions": db.query(models.DeliveryExceptionRecord).count(),
        "cache_backend": cache.backend_name(),
    }