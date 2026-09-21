import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class ReviewState(str, enum.Enum):
    pending = "pending"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"


class Workspace(Base):
    """A single tenant's workspace. Multiple rows now -- each browser session
    picks one to be 'active' (tracked client-side, see Layout/AppContext),
    and every record below is scoped to exactly one workspace via
    workspace_id. Logging out just forgets which workspace was active
    locally; nothing about the workspace or its data is touched server-side,
    so it's always there to resume."""
    __tablename__ = "workspaces"
    id = Column(String, primary_key=True, default=gen_id)
    company_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (UniqueConstraint("workspace_id", "po_number", name="uq_po_workspace_number"),)
    id = Column(String, primary_key=True, default=gen_id)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    po_number = Column(String, index=True)
    supplier_id = Column(String, nullable=True)
    order_date = Column(String, nullable=True)
    requested_delivery_date = Column(String, nullable=True)
    cost_center = Column(String, nullable=True)
    buyer_email = Column(String, nullable=True)
    line_items = Column(JSON, default=list)
    missing_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class Shipment(Base):
    __tablename__ = "shipments"
    __table_args__ = (UniqueConstraint("workspace_id", "shipment_id", name="uq_shipment_workspace_id"),)
    id = Column(String, primary_key=True, default=gen_id)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    shipment_id = Column(String, index=True)
    po_number = Column(String, nullable=True, index=True)
    carrier = Column(String, nullable=True)
    tracking_number = Column(String, nullable=True)
    ship_date = Column(String, nullable=True)
    eta = Column(String, nullable=True)
    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    status = Column(String, nullable=True)
    missing_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class InventoryChangeRecord(Base):
    __tablename__ = "inventory_changes"
    id = Column(String, primary_key=True, default=gen_id)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String, index=True)
    warehouse_id = Column(String, nullable=True)
    change_type = Column(String, nullable=True)
    quantity_delta = Column(Integer, nullable=True)
    recorded_by = Column(String, nullable=True)
    timestamp = Column(String, nullable=True)
    reason_code = Column(String, nullable=True)
    missing_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class SupplierEmailRecord(Base):
    __tablename__ = "supplier_emails"
    id = Column(String, primary_key=True, default=gen_id)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    received_at = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    referenced_po_number = Column(String, nullable=True, index=True)
    promised_date = Column(String, nullable=True)
    requested_action = Column(String, nullable=True)
    missing_fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeliveryExceptionRecord(Base):
    __tablename__ = "delivery_exceptions"
    __table_args__ = (UniqueConstraint("workspace_id", "exception_id", name="uq_exception_workspace_id"),)
    id = Column(String, primary_key=True, default=gen_id)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    exception_id = Column(String, index=True)
    po_number = Column(String, nullable=True, index=True)
    shipment_id = Column(String, nullable=True, index=True)
    exception_type = Column(String, nullable=True)
    detected_at = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    related_sku = Column(String, nullable=True)
    missing_fields = Column(JSON, default=list)

    review_state = Column(Enum(ReviewState), default=ReviewState.pending)
    ai_summary = Column(Text, nullable=True)
    ai_suggested_action = Column(Text, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_generated_at = Column(DateTime, nullable=True)
    ai_cache_hit = Column(Integer, default=0)  # 0/1, surfaced for the Redis-cache demo in the UI

    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audit_entries = relationship("AuditLog", back_populates="exception", cascade="all, delete-orphan", passive_deletes=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True, default=gen_id)
    exception_pk = Column(String, ForeignKey("delivery_exceptions.id", ondelete="CASCADE"))
    actor = Column(String, default="system")
    action = Column(String)  # e.g. "ingested", "ai_summary_generated", "state_changed", "reviewed"
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    exception = relationship("DeliveryExceptionRecord", back_populates="audit_entries")
