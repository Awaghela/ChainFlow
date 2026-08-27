"""
validation_v1.py
-----------------
The FIRST constraint-check ruleset shipped in ChainFlow. It only checks
top-level required fields and does not:
  * inspect nested structures (e.g. line items inside a purchase order)
  * apply conditional requirements (e.g. reason_code only on adjustments)
  * parse free text (supplier email bodies) to recover fields like
    `promised_date` or `referenced_po_number`

This intentionally mirrors a first-pass rule set that later gets tightened
after real triage data shows what it's missing -- that tightening is v2.
"""

TOP_LEVEL_REQUIRED = {
    "purchase_order": ["supplier_id", "requested_delivery_date", "cost_center", "buyer_email"],
    "shipment_update": ["po_number", "tracking_number", "eta", "carrier", "destination"],
    "inventory_change": ["warehouse_id", "recorded_by", "timestamp"],
    "supplier_email": ["sender", "received_at"],  # body/extraction fields NOT checked in v1
    "delivery_exception": ["severity", "description"],
}


def check_record(record: dict) -> list[str]:
    """Return the list of fields v1 flags as missing for this record."""
    rtype = record["record_type"]
    flagged = []
    for field in TOP_LEVEL_REQUIRED.get(rtype, []):
        if record.get(field) in (None, "", []):
            flagged.append(field)
    return flagged
