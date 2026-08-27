import json
import subprocess
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = APP_DIR / "data"


def load_report() -> dict:
    path = DATA_DIR / "metrics_report.json"
    if not path.exists():
        recompute()
    with open(path) as f:
        return json.load(f)


def recompute() -> dict:
    """Re-runs scripts/compute_metrics.py in-process so the /metrics/recompute
    endpoint reflects the exact same code path as the CLI proof script."""
    sys.path.insert(0, str(BACKEND_DIR))
    from scripts.compute_metrics import (  # noqa: PLC0415
        compute_field_detection_metrics,
        compute_triage_metrics,
    )

    field_metrics = compute_field_detection_metrics()
    triage_metrics = compute_triage_metrics()
    report = {
        "generated_by": "app/services/metrics.py:recompute()",
        "missing_field_detection": field_metrics,
        "exception_triage_time": triage_metrics,
    }
    with open(DATA_DIR / "metrics_report.json", "w") as f:
        json.dump(report, f, indent=2)
    return report
