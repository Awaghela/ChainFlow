from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    row = db.query(models.WorkspaceSettings).filter(models.WorkspaceSettings.id == "default").first()
    if not row:
        return schemas.SettingsOut(company_name=None)
    return schemas.SettingsOut(company_name=row.company_name)


@router.put("", response_model=schemas.SettingsOut)
def update_settings(payload: schemas.SettingsIn, db: Session = Depends(get_db)):
    row = db.query(models.WorkspaceSettings).filter(models.WorkspaceSettings.id == "default").first()
    if not row:
        row = models.WorkspaceSettings(id="default", company_name=payload.company_name)
        db.add(row)
    else:
        row.company_name = payload.company_name
    db.commit()
    db.refresh(row)
    return schemas.SettingsOut(company_name=row.company_name)
