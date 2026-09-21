from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routers.seed import MODEL_BY_TYPE, _delete_workspace_audit_logs

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=schemas.WorkspaceOut)
def create_workspace(payload: schemas.WorkspaceCreate, db: Session = Depends(get_db)):
    name = payload.company_name.strip()
    if not name:
        raise HTTPException(400, "Company name is required.")
    ws = models.Workspace(company_name=name)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws


@router.get("", response_model=list[schemas.WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    """Every workspace that has ever been created, newest first -- this
    powers the 'resume a previous workspace' picker on the logged-out
    screen. No auth boundary: anyone with the deployed URL can see this
    list, which is fine for a personal demo tool but worth knowing if this
    were ever used by multiple distinct real users."""
    return db.query(models.Workspace).order_by(models.Workspace.created_at.desc()).all()


@router.get("/{workspace_id}", response_model=schemas.WorkspaceOut)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found.")
    return ws


@router.put("/{workspace_id}", response_model=schemas.WorkspaceOut)
def update_workspace(workspace_id: str, payload: schemas.WorkspaceUpdate, db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found.")
    name = payload.company_name.strip()
    if not name:
        raise HTTPException(400, "Company name is required.")
    ws.company_name = name
    db.commit()
    db.refresh(ws)
    return ws


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a workspace and every record in it. Unlike
    'Clear all workspace data' (which keeps the workspace itself, just
    empties it), this removes the workspace from the resume list entirely.
    Same deletion order as wipe_all_records in seed.py, reused directly:
    audit logs first (FK to exceptions), then every record table, then the
    workspace row itself last."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found.")

    _delete_workspace_audit_logs(db, workspace_id)
    for model_cls, _ in MODEL_BY_TYPE.values():
        db.query(model_cls).filter(model_cls.workspace_id == workspace_id).delete()
    db.delete(ws)
    db.commit()
    return {"deleted": True, "workspace_id": workspace_id}
