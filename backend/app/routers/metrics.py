from fastapi import APIRouter

from app.services import metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
def get_metrics():
    return metrics_service.load_report()


@router.post("/recompute")
def recompute_metrics():
    """Re-runs the same validators + triage simulation live and overwrites
    the report. Useful to prove the numbers aren't hard-coded — hit this and
    watch it regenerate from the ruleset + dataset in this repo."""
    return metrics_service.recompute()
