from __future__ import annotations

import threading
from datetime import datetime
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import Settings
from app.database.connection import SessionLocal
from app.database.models import models as db_models

_engines: dict[str, Engine] = {}
_engines_lock = threading.Lock()


def _get_default_environment(workspace_id: Optional[int]) -> Optional[db_models.Environment]:
    if workspace_id is None:
        return None
    db = SessionLocal()
    try:
        env = (
            db.query(db_models.Environment)
            .filter(db_models.Environment.workspace_id == workspace_id)
            .order_by(db_models.Environment.id)
            .first()
        )
        if env:
            return env

        now = datetime.utcnow()
        env = db_models.Environment(
            name="default",
            description="Default environment",
            dbt_target_name=None,
            connection_profile_reference=None,
            variables={},
            default_retention_policy=None,
            created_at=now,
            updated_at=now,
            workspace_id=workspace_id,
        )
        db.add(env)
        db.commit()
        db.refresh(env)
        return env
    finally:
        db.close()


def resolve_environment(workspace_id: Optional[int], environment_id: Optional[int]) -> Optional[db_models.Environment]:
    if environment_id is None:
        return _get_default_environment(workspace_id)

    db = SessionLocal()
    try:
        query = db.query(db_models.Environment).filter(db_models.Environment.id == environment_id)
        if workspace_id is not None:
            query = query.filter(db_models.Environment.workspace_id == workspace_id)
        env = query.first()
        if env is None and workspace_id is not None:
            raise ValueError("Environment does not belong to the active workspace")
        return env
    finally:
        db.close()


def connection_url_for_environment(settings: Settings, environment: Optional[db_models.Environment]) -> str:
    if environment and isinstance(environment.variables, dict):
        variables = environment.variables or {}
        for key in ("sql_workspace_connection_url", "warehouse_connection_url"):
            url = variables.get(key)
            if isinstance(url, str) and url:
                return url

    if settings.sql_workspace_default_connection_url:
        return settings.sql_workspace_default_connection_url

    raise ValueError("No SQL workspace connection URL configured")


def get_engine(connection_url: str) -> Engine:
    with _engines_lock:
        engine = _engines.get(connection_url)
        if engine is None:
            engine = create_engine(connection_url)
            _engines[connection_url] = engine
        return engine

