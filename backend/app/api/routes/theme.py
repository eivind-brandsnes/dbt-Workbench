from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import UserContext, WorkspaceContext, get_current_user, get_current_workspace
from app.database.connection import SessionLocal
from app.database.models import models as db_models
from app.schemas.theme import (
    ThemeColors,
    ThemeDerived,
    ThemeModeConfig,
    ThemePreference,
    ThemePreferenceResponse,
)
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
        return ThemePreferenceResponse(
            version=1,
            light=ThemeModeConfig(
                colors=ThemeColors(
                    primary="#3b82f6",
                    secondary="#6366f1",
                    background="#ffffff",
                    surface="#f8fafc",
                    text="#1e293b",
                ),
                derived=ThemeDerived(
                    primary_hover="#2563eb",
                    primary_active="#1d4ed8",
                    primary_foreground="#ffffff",
                    secondary_hover="#4f46e5",
                    secondary_active="#3b82f6",
                    secondary_foreground="#ffffff",
                    text_muted="#64748b",
                    bg_muted="#f1f5f9",
                    surface_muted="#f1f5f9",
                    border="#e2e8f0",
                    ring="#94a3b8",
                ),
            ),
            dark=ThemeModeConfig(
                colors=ThemeColors(
                    primary="#3b82f6",
                    secondary="#6366f1",
                    background="#0f172a",
                    surface="#1e293b",
                    text="#e2e8f0",
                ),
                derived=ThemeDerived(
                    primary_hover="#2563eb",
                    primary_active="#1d4ed8",
                    primary_foreground="#ffffff",
                    secondary_hover="#4f46e5",
                    secondary_active="#3b82f6",
                    secondary_foreground="#ffffff",
                    text_muted="#94a3b8",
                    bg_muted="#334155",
                    surface_muted="#334155",
                    border="#1e293b",
                    ring="#60a5fa",
                ),
            ),
        )
    try:
        return ThemePreferenceResponse(**record.theme)
    except Exception:
        return ThemePreferenceResponse(
            version=1,
            light=ThemeModeConfig(
                colors=ThemeColors(
                    primary="#3b82f6",
                    secondary="#6366f1",
                    background="#ffffff",
                    surface="#f8fafc",
                    text="#1e293b",
                ),
                derived=ThemeDerived(
                    primary_hover="#2563eb",
                    primary_active="#1d4ed8",
                    primary_foreground="#ffffff",
                    secondary_hover="#4f46e5",
                    secondary_active="#3b82f6",
                    secondary_foreground="#ffffff",
                    text_muted="#64748b",
                    bg_muted="#f1f5f9",
                    surface_muted="#f1f5f9",
                    border="#e2e8f0",
                    ring="#94a3b8",
                ),
            ),
            dark=ThemeModeConfig(
                colors=ThemeColors(
                    primary="#3b82f6",
                    secondary="#6366f1",
                    background="#0f172a",
                    surface="#1e293b",
                    text="#e2e8f0",
                ),
                derived=ThemeDerived(
                    primary_hover="#2563eb",
                    primary_active="#1d4ed8",
                    primary_foreground="#ffffff",
                    secondary_hover="#4f46e5",
                    secondary_active="#3b82f6",
                    secondary_foreground="#ffffff",
                    text_muted="#94a3b8",
                    bg_muted="#334155",
                    surface_muted="#334155",
                    border="#1e293b",
                    ring="#60a5fa",
                ),
            ),
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
