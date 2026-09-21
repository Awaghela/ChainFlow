import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.deps import get_workspace_id
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


def _delete_workspace_audit_logs(db: Session, workspace_id: str) -> int:
    """AuditLog has no workspace_id column of its own -- it's scoped via
    exception_pk -> DeliveryExceptionRecord.workspace_id. Deleted explicitly
    here (rather than relying solely on the DB-level ON DELETE CASCADE) so
    behavior is identical on SQLite, which doesn't enforce foreign keys by
    default."""
    exception_ids = [
        row[0] for row in
        db.query(models.DeliveryExceptionRecord.id).filter(models.DeliveryExceptionRecord.workspace_id == workspace_id).all()
    ]
    if not exception_ids:
        return 0
    return (
        db.query(models.AuditLog)
        .filter(models.AuditLog.exception_pk.in_(exception_ids))
        .delete(synchronize_session=False)
    )


@router.post("/seed/load")
def load_seed(db: Session = Depends(get_db), workspace_id: str = Depends(get_workspace_id), reset: bool = True):
    with open(DATA_DIR / "seed_dataset.json") as f:
        dataset = json.load(f)

    if reset:
        _delete_workspace_audit_logs(db, workspace_id)
        for model_cls, _ in MODEL_BY_TYPE.values():
            db.query(model_cls).filter(model_cls.workspace_id == workspace_id).delete()
        db.commit()

    counts = {k: 0 for k in MODEL_BY_TYPE}
    for rec in dataset["records"]:
        rtype = rec["record_type"]
        model_cls, key_field = MODEL_BY_TYPE[rtype]
        missing = validator.check_record(rec)
        fields = {k: v for k, v in rec.items() if k in model_cls.__table__.columns.keys()}
        # The seed JSON's own "id" (e.g. "EXC-3018") must NOT be reused as the
        # literal primary key: it's a plain string, not scoped to a workspace,
        # so loading the same static dataset into a second workspace would
        # collide on this table's real PK. Drop it and let the model's
        # gen_id() default assign a fresh UUID -- the *natural* key fields
        # (po_number, exception_id, etc.) are preserved as-is and are what
        # the workspace-scoped uniqueness constraints actually apply to.
        fields.pop("id", None)
        fields["missing_fields"] = missing
        fields["workspace_id"] = workspace_id
        obj = model_cls(**fields)
        db.add(obj)
        counts[rtype] += 1
    db.commit()

    return {
        "loaded": counts,
        "total": sum(counts.values()),
    }


@router.delete("/records/all")
def wipe_all_records(db: Session = Depends(get_db), workspace_id: str = Depends(get_workspace_id)):
    """Clears every record and audit entry in THIS workspace only. Used by
    the 'Clear all workspace data' action in Settings — does not touch the
    workspace's own name, and never touches other workspaces' data."""
    audit_deleted = _delete_workspace_audit_logs(db, workspace_id)
    counts = {}
    for rtype, (model_cls, _) in MODEL_BY_TYPE.items():
        counts[rtype] = db.query(model_cls).filter(model_cls.workspace_id == workspace_id).delete()
    db.commit()
    return {"cleared": counts, "audit_entries_cleared": audit_deleted}


@router.get("/seed/status")
def seed_status(db: Session = Depends(get_db), workspace_id: str = Depends(get_workspace_id)):
    return {
        "purchase_orders": db.query(models.PurchaseOrder).filter(models.PurchaseOrder.workspace_id == workspace_id).count(),
        "shipments": db.query(models.Shipment).filter(models.Shipment.workspace_id == workspace_id).count(),
        "inventory_changes": db.query(models.InventoryChangeRecord).filter(models.InventoryChangeRecord.workspace_id == workspace_id).count(),
        "supplier_emails": db.query(models.SupplierEmailRecord).filter(models.SupplierEmailRecord.workspace_id == workspace_id).count(),
        "delivery_exceptions": db.query(models.DeliveryExceptionRecord).filter(models.DeliveryExceptionRecord.workspace_id == workspace_id).count(),
        "cache_backend": cache.backend_name(),
    }
