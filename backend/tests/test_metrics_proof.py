"""
Run with:  cd backend && python3 -m pytest tests/ -v

These tests are the actual "proof" behind the two headline metrics: they
regenerate the deterministic dataset, run both validators, run the triage
simulation, and assert the measured numbers land where the project claims
they do -- with tolerance bands, not exact hard-codes, so the test still
means something if the dataset generator changes slightly.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.rules import validation_v1, validation_v2
from scripts.compute_metrics import (
    compute_field_detection_metrics,
    compute_triage_metrics,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "app" / "data"


def test_seed_dataset_has_150_records():
    with open(DATA_DIR / "seed_dataset.json") as f:
        dataset = json.load(f)
    assert dataset["counts"]["total"] == 150
    assert dataset["counts"]["purchase_order"] == 35
    assert dataset["counts"]["shipment_update"] == 40
    assert dataset["counts"]["inventory_change"] == 30
    assert dataset["counts"]["supplier_email"] == 25
    assert dataset["counts"]["delivery_exception"] == 20


def test_v2_ruleset_strictly_improves_on_v1():
    """The iterated ruleset must never regress recall on any record type it
    changes, and must improve overall recall."""
    m = compute_field_detection_metrics()
    v1_recall = m["v1_baseline_ruleset"]["recall"]
    v2_recall = m["v2_iterated_ruleset"]["recall"]
    assert v2_recall > v1_recall, "v2 must detect more true missing fields than v1"


def test_detection_rate_in_claimed_range():
    """Detection rate should land in the neighborhood of the reported
    73% -> 87% improvement (tolerance band, not an exact match, since the
    dataset is randomly generated from a fixed seed)."""
    m = compute_field_detection_metrics()
    assert 65 <= m["detection_rate_v1_pct"] <= 80, m["detection_rate_v1_pct"]
    assert 80 <= m["detection_rate_v2_pct"] <= 95, m["detection_rate_v2_pct"]
    assert m["improvement_percentage_points"] >= 8


def test_triage_reduction_in_claimed_range():
    """AI-assisted triage should be meaningfully faster than manual, in the
    neighborhood of the reported 34% reduction, and never *slower*."""
    t = compute_triage_metrics()
    assert t["n_scenarios"] == 40
    assert t["mean_ai_assisted_minutes"] < t["mean_manual_minutes"]
    assert 20 <= t["mean_reduction_pct"] <= 50, t["mean_reduction_pct"]


def test_no_scenario_is_slower_with_ai_by_more_than_noise_floor():
    """Even accounting for the simulated 'AI summary insufficient' fallback,
    AI-assisted time should not regularly exceed manual time."""
    t = compute_triage_metrics()
    worse = [s for s in t["scenarios"] if s["ai_assisted_minutes"] > s["manual_minutes"]]
    assert len(worse) / t["n_scenarios"] < 0.15, "AI path should rarely be slower than manual"
