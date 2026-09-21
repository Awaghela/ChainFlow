"""
Shared FastAPI dependencies. Multi-workspace scoping works via a simple
request header (X-Workspace-Id) rather than real authentication -- there's
no login/password in this app, just "which workspace is the browser
currently pointed at" (tracked client-side in localStorage, see
frontend/src/context/AppContext.tsx). Every data-bearing endpoint depends
on get_workspace_id to scope its query/insert to exactly one workspace.
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models


def get_workspace_id(x_workspace_id: str | None = Header(default=None)) -> str:
    if not x_workspace_id:
        raise HTTPException(400, "Missing X-Workspace-Id header — no active workspace selected.")
    return x_workspace_id


def get_current_workspace(
    workspace_id: str = Depends(get_workspace_id),
    db: Session = Depends(get_db),
) -> models.Workspace:
    """Like get_workspace_id, but also confirms the workspace still exists --
    use this where a stale/deleted workspace_id should fail loudly (e.g. the
    app's boot check) rather than silently scoping queries to nothing."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found — it may have been removed.")
    return ws
