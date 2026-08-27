from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class RecordIngest(BaseModel):
    """Generic envelope used by POST /ingest — accepts any of the five
    simulated record types and routes by `record_type`."""
    record_type: str
    payload: dict[str, Any]


class ExceptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    exception_id: str
    po_number: Optional[str] = None
    shipment_id: Optional[str] = None
    exception_type: Optional[str] = None
    detected_at: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    related_sku: Optional[str] = None
    missing_fields: list[str] = []

    review_state: str
    ai_summary: Optional[str] = None
    ai_suggested_action: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_generated_at: Optional[datetime] = None
    ai_cache_hit: int = 0

    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class ReviewAction(BaseModel):
    action: str  # "approve" | "reject" | "escalate" | "start_review"
    actor: str = "ops_analyst"
    note: Optional[str] = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    actor: str
    action: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime


class GenericRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    missing_fields: list[str] = []


class SettingsOut(BaseModel):
    company_name: Optional[str] = None


class SettingsIn(BaseModel):
    company_name: str


class SeedResponse(BaseModel):
    purchase_orders: int
    shipments: int
    inventory_changes: int
    supplier_emails: int
    delivery_exceptions: int
    total: int
