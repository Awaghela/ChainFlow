# ChainFlow — Measured Metrics Report

Generated from `backend/scripts/compute_metrics.py` against the 150-record
seed dataset (`app/data/seed_dataset.json`). Every number below is computed
from code in this repo, not asserted — re-run the script and the same
(seeded, deterministic) numbers come back out.

## Missing-field detection

| Ruleset | Detection rate (recall) | Precision | Ground-truth missing fields | Caught |
|---|---|---|---|---|
| v1 (baseline) | **72.0%** | 100.0% | 25 | 18 |
| v2 (iterated) | **88.0%** | 100.0% | 25 | 22 |

**Improvement: 16.0 percentage points**, driven by three concrete
rule additions (see `app/rules/validation_v2.py`): nested line-item checks,
conditional-field checks (e.g. `reason_code` on adjustments), and lightweight
extraction of `referenced_po_number` / `promised_date` from supplier email text.

Recall by record type (v1 → v2):
- supplier_email: 0.2 → 0.4
- purchase_order: 0.8 → 1.0
- shipment_update: 1.0 → 1.0
- delivery_exception: None → None
- inventory_change: 0.6667 → 1.0

## Exception triage time (40 simulated scenarios)

| | Manual | AI-assisted |
|---|---|---|
| Mean | 10.74 min | 6.95 min |
| Median | 10.97 min | 6.99 min |

**Mean reduction: 35.2%** (median: 36.2%)

Methodology is documented in full in `METHODOLOGY.md` and inline in
`compute_metrics.py` — each scenario is scored on missing-field count,
number of linked records to cross-reference, and text ambiguity, with a
12% simulated rate of the AI summary being insufficient (forcing partial
manual fallback), so the number reflects a realistic ceiling, not a
best-case demo.