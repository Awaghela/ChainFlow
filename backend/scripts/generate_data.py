"""
generate_data.py
-----------------
Generates the 150 simulated supply-chain records referenced in the ChainFlow
project (purchase orders, shipment updates, inventory changes, supplier
emails, delivery exceptions).

Every record is generated with a KNOWN ground truth of which required fields
were dropped to simulate messy real-world data entry. That ground truth is
what lets `compute_metrics.py` measure missing-field detection rate
objectively instead of asserting it.

Deterministic: seeded RNG so the dataset (and therefore the metrics) are
reproducible run to run.
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)

OUT_DIR = Path(__file__).resolve().parent.parent / "app" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ----------------------------------------------------------------------------
# Required-field schemas per record type.
# Tuples of (field, always_required: bool, condition_fn or None)
# condition_fn(record) -> bool tells us when a conditionally-required field
# actually applies (e.g. reason_code is only required for 'adjustment').
# ----------------------------------------------------------------------------

SUPPLIERS = [f"SUP-{i:03d}" for i in range(1, 21)]
WAREHOUSES = ["WH-DEN", "WH-ATL", "WH-DAL", "WH-PHX", "WH-SEA"]
SKUS = [f"SKU-{fake.bothify(text='??-####').upper()}" for _ in range(60)]
CARRIERS = ["FreightWays", "Coldline Logistics", "Apex Cargo", "Meridian Transport", "Vantage Freight"]


def rand_date(start_days_ago=60, end_days_ahead=30):
    return (datetime(2026, 1, 5) + timedelta(days=random.randint(-start_days_ago, end_days_ahead)))


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def maybe_drop(record, field, drop_prob, messy):
    """Randomly null out a field to simulate a real data-quality gap."""
    if messy and random.random() < drop_prob:
        record[field] = None
        return True
    return False


def gen_purchase_order(idx, messy_rate=0.28):
    messy = random.random() < messy_rate
    order_date = rand_date(45, 5)
    n_items = random.randint(1, 5)
    line_items = [
        {
            "sku": random.choice(SKUS),
            "qty": random.randint(10, 500),
            "unit_price": round(random.uniform(2.5, 240.0), 2),
        }
        for _ in range(n_items)
    ]
    rec = {
        "record_type": "purchase_order",
        "id": f"PO-{2026000 + idx}",
        "po_number": f"PO-{2026000 + idx}",
        "supplier_id": random.choice(SUPPLIERS),
        "order_date": iso(order_date),
        "requested_delivery_date": iso(order_date + timedelta(days=random.randint(5, 21))),
        "line_items": line_items,
        "cost_center": f"CC-{random.randint(100, 499)}",
        "buyer_email": fake.company_email(),
    }
    missing = set()
    # Required, always
    for f, prob in [
        ("supplier_id", 0.12), ("requested_delivery_date", 0.16),
        ("cost_center", 0.22), ("buyer_email", 0.10),
    ]:
        if maybe_drop(rec, f, prob, messy):
            missing.add(f)
    # Nested requirement: every line item needs qty + unit_price + sku
    if messy and random.random() < 0.18:
        broken_item = random.choice(rec["line_items"])
        drop_field = random.choice(["qty", "unit_price", "sku"])
        broken_item[drop_field] = None
        missing.add(f"line_items[].{drop_field}")
    rec["_ground_truth_missing"] = sorted(missing)
    return rec


def gen_shipment(idx, po_pool, messy_rate=0.30):
    messy = random.random() < messy_rate
    ship_date = rand_date(30, 2)
    rec = {
        "record_type": "shipment_update",
        "id": f"SHP-{5000 + idx}",
        "shipment_id": f"SHP-{5000 + idx}",
        "po_number": random.choice(po_pool) if po_pool else None,
        "carrier": random.choice(CARRIERS),
        "tracking_number": fake.bothify(text="TRK########"),
        "ship_date": iso(ship_date),
        "eta": iso(ship_date + timedelta(days=random.randint(2, 12))),
        "origin": fake.city(),
        "destination": random.choice(WAREHOUSES),
        "status": random.choice(["in_transit", "delayed", "delivered", "customs_hold"]),
    }
    missing = set()
    for f, prob in [
        ("po_number", 0.15), ("tracking_number", 0.14), ("eta", 0.20),
        ("carrier", 0.08), ("destination", 0.10),
    ]:
        if maybe_drop(rec, f, prob, messy):
            missing.add(f)
    rec["_ground_truth_missing"] = sorted(missing)
    return rec


def gen_inventory_change(idx, messy_rate=0.24):
    messy = random.random() < messy_rate
    change_type = random.choice(["receipt", "shipment", "adjustment", "cycle_count"])
    rec = {
        "record_type": "inventory_change",
        "id": f"INV-{9000 + idx}",
        "sku": random.choice(SKUS),
        "warehouse_id": random.choice(WAREHOUSES),
        "change_type": change_type,
        "quantity_delta": random.randint(-200, 400),
        "recorded_by": fake.user_name(),
        "timestamp": iso(rand_date(20, 1)),
        "reason_code": (f"RC-{random.randint(1,9)}" if change_type == "adjustment" else None),
    }
    missing = set()
    for f, prob in [
        ("warehouse_id", 0.10), ("recorded_by", 0.18), ("timestamp", 0.08),
    ]:
        if maybe_drop(rec, f, prob, messy):
            missing.add(f)
    # Conditional requirement: adjustment MUST carry a reason_code
    if change_type == "adjustment":
        if messy and random.random() < 0.35:
            rec["reason_code"] = None
            missing.add("reason_code")
    rec["_ground_truth_missing"] = sorted(missing)
    return rec


EMAIL_TEMPLATES = [
    "Hi team, following up on {po}. We can now confirm the shipment will be ready by {date}. Let us know if that works.",
    "Apologies for the delay on {po} — our production line had an issue. {date_clause}",
    "Please note a partial shipment against {po} is going out this week. Remainder to follow.",
    "We need to update the delivery window for {po}. {date_clause} Please confirm receipt of this change.",
    "Quality hold placed on the last lot for {po}. Investigating and will advise on {date_clause_lower}",
]


def gen_supplier_email(idx, po_pool, messy_rate=0.42):
    """Supplier emails are free text -- required fields are *extracted*
    (referenced_po_number, promised_date, requested_action). These are the
    messiest source in the dataset, mirroring real supplier inboxes."""
    messy = random.random() < messy_rate
    po = random.choice(po_pool) if po_pool else f"PO-{2026000+idx}"
    date = rand_date(5, 25)
    date_str = date.strftime("%B %d")
    template = random.choice(EMAIL_TEMPLATES)
    body = template.format(
        po=po, date=date_str,
        date_clause=f"New promised date: {date_str}.",
        date_clause_lower=f"new promised date: {date_str}.",
    )

    rec = {
        "record_type": "supplier_email",
        "id": f"EML-{7000 + idx}",
        "sender": fake.company_email(),
        "subject": random.choice(["RE: Delivery update", "Shipment delay notice", "PO status", "Quality hold", "Partial shipment notice"]),
        "received_at": iso(rand_date(20, 0)),
        "body": body,
        # These three are only knowable by parsing `body` -- this is the
        # extraction step that gets better as the validator / prompt improves.
        "referenced_po_number": po,
        "promised_date": iso(date) if "date" in body.lower() or "promised" in body.lower() else None,
        "requested_action": None,
    }
    # Derive a requested_action label for ~70% of emails (some are pure FYI)
    if "confirm" in body.lower():
        rec["requested_action"] = "confirm_receipt"
    elif "hold" in body.lower():
        rec["requested_action"] = "await_update"
    elif "partial" in body.lower():
        rec["requested_action"] = "acknowledge_partial"

    missing = set()
    for f, prob in [
        ("sender", 0.06), ("received_at", 0.08),
    ]:
        if maybe_drop(rec, f, prob, messy):
            missing.add(f)
    # Messy real-world emails frequently omit the PO reference or a clear date
    if messy and random.random() < 0.30:
        rec["referenced_po_number"] = None
        missing.add("referenced_po_number")
    if messy and random.random() < 0.34 and rec["promised_date"]:
        rec["promised_date"] = None
        missing.add("promised_date")
    elif rec["promised_date"] is None and ("delay" in body.lower() or "update" in body.lower() or "promised" in body.lower()):
        # promised_date genuinely should have been extractable/expected but wasn't
        missing.add("promised_date")
    rec["_ground_truth_missing"] = sorted(missing)
    return rec


EXCEPTION_TYPES = ["quantity_mismatch", "damaged", "late_arrival", "wrong_item", "missing_docs", "customs_hold"]

# Realistic, readable description templates per exception type. Uses its own
# isolated RNG (seeded per-record) so it never touches the shared `random`
# module state -- this keeps every other record type, and every missing-field
# ground-truth label, byte-for-byte identical to before. Only the *text* of
# the description changes; nothing that affects the measured metrics does.
DESCRIPTION_TEMPLATES = {
    "quantity_mismatch": [
        lambda r: f"Received {r.randint(60, 95)} units against a PO quantity of {r.randint(100, 150)} — shipment is short.",
        lambda r: f"Carton count on arrival does not match the packing list; short by {r.randint(5, 40)} units.",
        lambda r: f"Quantity received is {r.randint(10, 30)} units over what was ordered; awaiting confirmation from the supplier.",
    ],
    "damaged": [
        lambda r: f"{r.randint(1, 6)} of the cartons in this shipment arrived with visible water damage; contents flagged for inspection.",
        lambda r: "Pallet was crushed in transit — outer packaging damage affects an estimated portion of the load.",
        lambda r: f"Product arrived with cracked casings on {r.randint(2, 12)} units; supplier notified and replacement requested.",
    ],
    "late_arrival": [
        lambda r: f"Shipment is running {r.randint(1, 7)} days behind the original ETA due to a carrier routing delay.",
        lambda r: f"Carrier reported a {r.randint(2, 5)}-day delay caused by port congestion at the origin hub.",
        lambda r: f"Delivery missed its scheduled window by {r.randint(1, 4)} days; downstream production may be affected.",
    ],
    "wrong_item": [
        lambda r: "Received SKU does not match the purchase order — supplier appears to have shipped the wrong item.",
        lambda r: "Packing slip lists a different product than what was ordered; verifying with the supplier before accepting.",
        lambda r: "Item received does not match the description or SKU on file for this PO.",
    ],
    "missing_docs": [
        lambda r: "Required customs declaration was not included with this shipment.",
        lambda r: "Certificate of origin is missing from the shipment paperwork.",
        lambda r: "Compliance documentation for this lot was not received alongside the shipment.",
    ],
    "customs_hold": [
        lambda r: "Shipment is being held at customs pending additional documentation.",
        lambda r: "Customs flagged this shipment for manual inspection; release date not yet confirmed.",
        lambda r: "Import clearance is delayed — customs office is requesting an updated commercial invoice.",
    ],
}


def gen_exception_description(idx, etype):
    local_rng = random.Random(90000 + idx)  # isolated: never touches the shared `random` state
    template = local_rng.choice(DESCRIPTION_TEMPLATES[etype])
    return template(local_rng)


def gen_delivery_exception(idx, po_pool, shp_pool, messy_rate=0.33):
    messy = random.random() < messy_rate
    etype = random.choice(EXCEPTION_TYPES)
    rec = {
        "record_type": "delivery_exception",
        "id": f"EXC-{3000 + idx}",
        "exception_id": f"EXC-{3000 + idx}",
        "po_number": random.choice(po_pool) if po_pool and random.random() < 0.7 else None,
        "shipment_id": random.choice(shp_pool) if shp_pool and random.random() < 0.7 else None,
        "exception_type": etype,
        "detected_at": iso(rand_date(15, 0)),
        "severity": random.choice(["low", "medium", "high", "critical"]),
        "description": gen_exception_description(idx, etype),
        "related_sku": (random.choice(SKUS) if etype in ("quantity_mismatch", "damaged", "wrong_item") else None),
    }
    # at least one of po_number / shipment_id must be present
    if not rec["po_number"] and not rec["shipment_id"]:
        rec["po_number"] = random.choice(po_pool) if po_pool else None

    missing = set()
    for f, prob in [("severity", 0.10), ("description", 0.08)]:
        if maybe_drop(rec, f, prob, messy):
            missing.add(f)
    if rec["exception_type"] in ("quantity_mismatch", "damaged", "wrong_item"):
        if messy and random.random() < 0.30:
            rec["related_sku"] = None
            missing.add("related_sku")
    rec["_ground_truth_missing"] = sorted(missing)
    return rec


def main():
    n_po, n_shp, n_inv, n_eml, n_exc = 35, 40, 30, 25, 20
    assert n_po + n_shp + n_inv + n_eml + n_exc == 150

    pos = [gen_purchase_order(i) for i in range(n_po)]
    po_numbers = [p["po_number"] for p in pos]

    shipments = [gen_shipment(i, po_numbers) for i in range(n_shp)]
    shipment_ids = [s["shipment_id"] for s in shipments]

    inventory = [gen_inventory_change(i) for i in range(n_inv)]
    emails = [gen_supplier_email(i, po_numbers) for i in range(n_eml)]
    exceptions = [gen_delivery_exception(i, po_numbers, shipment_ids) for i in range(n_exc)]

    all_records = pos + shipments + inventory + emails + exceptions
    random.shuffle(all_records)

    dataset = {
        "generated_at": datetime(2026, 2, 1).isoformat(),
        "counts": {
            "purchase_order": n_po, "shipment_update": n_shp,
            "inventory_change": n_inv, "supplier_email": n_eml,
            "delivery_exception": n_exc, "total": len(all_records),
        },
        "records": all_records,
    }

    with open(OUT_DIR / "seed_dataset.json", "w") as f:
        json.dump(dataset, f, indent=2)

    print(f"Generated {len(all_records)} records -> {OUT_DIR / 'seed_dataset.json'}")
    print(dataset["counts"])


if __name__ == "__main__":
    main()