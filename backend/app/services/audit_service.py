from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.database.models import models as db_models


def record_audit(
    db: Session,
    *,
    workspace_id: int,
    user_id: int | None,
    username: str | None,
    action: str,
    resource: str,
    metadata: Dict[str, Any] | None = None,
    commit_hash: str | None = None,
    environment: str | None = None,
) -> db_models.AuditLog:
    entry = db_models.AuditLog(
        workspace_id=workspace_id,
        user_id=user_id,
        username=username,
        action=action,
        resource=resource,
        metadata_=metadata or {},
        created_at=datetime.now(timezone.utc),
        commit_hash=commit_hash,
        environment=environment,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_audit_records(db: Session, workspace_id: int, limit: int = 200) -> List[db_models.AuditLog]:
    return (
        db.query(db_models.AuditLog)
        .filter(db_models.AuditLog.workspace_id == workspace_id)
        .order_by(db_models.AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
