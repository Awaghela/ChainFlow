"""
validation_v2.py
-----------------
The ITERATED constraint-check ruleset. Built after reviewing which
false negatives v1 was letting through during triage review. Adds three
capabilities on top of v1:

  1. Nested-field checks (purchase_order.line_items[].{sku,qty,unit_price})
  2. Conditional requirements (inventory_change.reason_code when
     change_type == 'adjustment'; delivery_exception.related_sku when the
     exception type implies a specific item is involved)
  3. Lightweight extraction over supplier_email.body to recover
     referenced_po_number and promised_date when the structured field is
     empty but the information is actually present in the text -- this is
     the rule-based stand-in for the "LLM-generated summary" extraction
     step; app/services/llm.py performs the live equivalent against the
     Claude API.

This is what "prompt / rule iteration" means concretely: each capability
here was added in response to a specific missed field category from v1.
"""
import re

from app.rules.validation_v1 import TOP_LEVEL_REQUIRED

CONDITIONAL_SKU_TYPES = {"quantity_mismatch", "damaged", "wrong_item"}

PO_PATTERN = re.compile(r"PO-\d{6,7}")
DATE_HINT = re.compile(r"\b(delay|update|promised|new (?:promised )?date)\b", re.IGNORECASE)


def _extract_email_fields(record: dict) -> dict:
    body = record.get("body") or ""
    extracted = {}
    if not record.get("referenced_po_number"):
        m = PO_PATTERN.search(body)
        if m:
            extracted["referenced_po_number"] = m.group(0)
    if not record.get("promised_date"):
        if DATE_HINT.search(body):
            # A date-shaped promise is implied by the text but the field is
            # empty -- v2 still flags this as missing (extraction alone
            # can't invent a date), which is the correct, honest behavior.
            extracted["promised_date"] = None
    return extracted


def check_record(record: dict) -> list[str]:
    rtype = record["record_type"]
    flagged: list[str] = []

    for field in TOP_LEVEL_REQUIRED.get(rtype, []):
        if record.get(field) in (None, "", []):
            flagged.append(field)

    if rtype == "purchase_order":
        for i, item in enumerate(record.get("line_items") or []):
            for f in ("sku", "qty", "unit_price"):
                if item.get(f) in (None, "", []):
                    flagged.append(f"line_items[].{f}")

    if rtype == "inventory_change":
        if record.get("change_type") == "adjustment" and not record.get("reason_code"):
            flagged.append("reason_code")

    if rtype == "delivery_exception":
        if record.get("exception_type") in CONDITIONAL_SKU_TYPES and not record.get("related_sku"):
            flagged.append("related_sku")
        if not record.get("po_number") and not record.get("shipment_id"):
            flagged.append("po_number_or_shipment_id")

    if rtype == "supplier_email":
        if not record.get("referenced_po_number"):
            recovered = _extract_email_fields(record)
            if "referenced_po_number" not in recovered:
                flagged.append("referenced_po_number")
            # else: successfully recovered from body, not flagged
        body = record.get("body") or ""
        if DATE_HINT.search(body) and not record.get("promised_date"):
            flagged.append("promised_date")

    return sorted(set(flagged))
