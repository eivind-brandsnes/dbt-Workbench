from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, WorkspaceContext, get_current_user, get_current_workspace
from app.database.connection import SessionLocal
from app.database.models import models as db_models
from app.schemas.theme import ThemePreference, ThemePreferenceResponse
from app.utils.theme import collect_violations, validate_theme_preference

router = APIRouter(prefix="/theme", tags=["theme"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_theme_record(
    db: Session,
    current_user: UserContext,
    workspace: WorkspaceContext,
) -> db_models.UserTheme | None:
    if current_user.id is not None:
        return (
            db.query(db_models.UserTheme)
            .filter(db_models.UserTheme.user_id == current_user.id)
            .first()
        )
    if workspace.id is None:
        return None
    return (
        db.query(db_models.UserTheme)
        .filter(db_models.UserTheme.workspace_id == workspace.id)
        .first()
    )


@router.get("", response_model=ThemePreferenceResponse)
def get_theme(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
    workspace: WorkspaceContext = Depends(get_current_workspace),
) -> ThemePreferenceResponse:
    record = _get_theme_record(db, current_user, workspace)
    if not record or not isinstance(record.theme, dict):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "theme_not_found", "message": "No theme preference stored."},
        )
    try:
        return ThemePreferenceResponse(**record.theme)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "theme_not_found", "message": "No valid theme preference stored."},
        )


@router.put("", response_model=ThemePreferenceResponse)
def save_theme(
    preference: ThemePreference,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
    workspace: WorkspaceContext = Depends(get_current_workspace),
) -> ThemePreferenceResponse:
    now = datetime.now(timezone.utc)
    checks_by_mode = validate_theme_preference(preference)
    violations = collect_violations(checks_by_mode)
    if violations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "theme_contrast_invalid",
                "message": "Theme does not meet WCAG contrast requirements.",
                "violations": violations,
            },
        )

    payload = preference.model_dump()
    record = _get_theme_record(db, current_user, workspace)

    if record:
        record.theme = payload
        record.updated_at = now
    else:
        record = db_models.UserTheme(
            user_id=current_user.id,
            workspace_id=None if current_user.id is not None else workspace.id,
            theme=payload,
            created_at=now,
            updated_at=now,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return ThemePreferenceResponse(**record.theme)


@router.delete("", status_code=status.HTTP_200_OK)
def reset_theme(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
    workspace: WorkspaceContext = Depends(get_current_workspace),
) -> dict:
    record = _get_theme_record(db, current_user, workspace)
    if not record:
        return {"message": "No theme preference to reset."}
    db.delete(record)
    db.commit()
    return {"message": "Theme preference reset."}
