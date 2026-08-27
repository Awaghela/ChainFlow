# Methodology

This document explains, precisely, how ChainFlow's two headline metrics are
produced — so they hold up under questioning rather than reading as
marketing copy.

## 1. Missing-field detection rate: 72.0% → 88.0%

**The dataset.** `backend/scripts/generate_data.py` generates 150 records
(35 purchase orders, 40 shipment updates, 30 inventory changes, 25 supplier
emails, 20 delivery exceptions) with a seeded RNG. For each record, a subset
of required fields is randomly nulled out to simulate real data-entry gaps —
and, critically, **the generator records exactly which fields it dropped**
as ground truth (`_ground_truth_missing` on every record). This is what
makes "detection rate" a measurable quantity instead of a guess: we know,
with certainty, what should have been flagged.

**The two rulesets.**
- `app/rules/validation_v1.py` checks only top-level required fields per
  record type. It has no visibility into nested structures (e.g. purchase
  order line items) or conditional requirements (e.g. inventory adjustments
  needing a `reason_code`), and does not parse free text — so it cannot
  recover `referenced_po_number` or `promised_date` from a supplier email
  body.
- `app/rules/validation_v2.py` adds exactly three capabilities, each in
  response to a specific gap category v1 was missing: nested line-item
  checks, conditional-field checks, and a lightweight regex-based extraction
  pass over supplier email text.

**The metric.** `compute_field_detection_metrics()` in
`compute_metrics.py` runs both validators against all 150 records and
computes **recall**: (fields correctly flagged as missing) / (fields
actually missing per ground truth). On the current seed, that's 18/25
(72.0%) for v1 and 22/25 (88.0%) for v2 — a 16 percentage point
improvement, driven almost entirely by the supplier-email extraction step
(where free text is the messiest source in the dataset) and the nested
purchase-order check.

Precision is also tracked (both rulesets are 100% precise on this seed —
neither ever flags a field that wasn't actually missing) so the comparison
isn't just "v2 flags more things," it's "v2 catches more *real* gaps
without more false alarms."

Run it yourself: `python3 backend/scripts/compute_metrics.py`, or hit
`POST /api/metrics/recompute` on the running API.

## 2. Exception triage time: 34–36% reduction

This metric is a **simulation**, and it's presented as one deliberately —
there's no claim that any specific ticket takes exactly the modeled number
of minutes. What it models is the *shape* of the workflow change: fewer
systems to open, less time hunting for missing data, because the analyst
reads one AI-generated brief that already cross-references the related
purchase order, shipment, and supplier emails, instead of opening each
separately.

**Complexity drivers**, assigned per scenario (`simulate_triage_scenarios`):
- `missing_fields` (0–4, weighted toward 1–2): how many required fields the
  exception's linked records are missing
- `related_records` (1–4, weighted toward 2): how many separate systems/
  records the analyst has to open
- `ambiguity` (low / medium / high): how much free-text interpretation is
  needed

**Manual time model** (minutes): `2.0 fixed + missing_fields × 1.8 +
related_records × 1.5 + ambiguity_bonus (0 / 2.5 / 5.0) + noise`

**AI-assisted time model** (minutes): `2.2 fixed + missing_fields × 0.9 +
related_records × 0.6 + ambiguity_bonus_ai (0 / 1.5 / 2.5) + noise`, plus a
**15% simulated chance** the AI summary is judged insufficient, adding back
35% of that scenario's manual time as a fallback cost.

Note the AI path isn't modeled as free: it still costs more time when there
are more missing fields (the AI can't invent data it doesn't have) and still
has a meaningful per-record verification cost, and it's deliberately made
"insufficient" some of the time. The goal was a defensible, not a flattering,
number.

**Result on the current seed**: mean manual time 10.74 min vs. mean
AI-assisted time 6.95 min → **35.2% reduction** (median: 36.2%). An
automated test (`test_no_scenario_is_slower_with_ai_by_more_than_noise_floor`)
also checks that the AI path isn't slower than manual in more than ~15% of
scenarios, so the fallback rate isn't silently dominating the result.

Both formulas, including the exact constants, live in
`backend/scripts/compute_metrics.py` and are reproduced in the docstring
above `simulate_triage_scenarios()`.

## Why re-run instead of trust a number in a doc

`backend/tests/test_metrics_proof.py` asserts both metrics land within
tolerance bands (not exact hard-codes, since minor generator changes will
shift the exact numbers slightly) every time it runs. The `/api/metrics/recompute`
endpoint re-executes the identical code path live, so the number on the
Proof & Metrics page in the app is never more than one API call away from
being regenerated from scratch.
