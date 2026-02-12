from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import datetime
from typing import Dict, Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.models import models as db_models

logger = logging.getLogger(__name__)


DEFAULT_ENV_FALLBACKS: Dict[str, str] = {
    "openai_api_key": "OPENAI_API_KEY",
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "gemini_api_key": "GEMINI_API_KEY",
}


class SecretEncryptionError(RuntimeError):
    pass


class AiSecretsService:
    _ephemeral_key = Fernet.generate_key()

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._fernet = Fernet(self._resolve_key())

    def _resolve_key(self) -> bytes:
        configured = self.settings.ai_secrets_master_key
        if configured:
            # Accept either 32-byte base64 key or arbitrary secret material.
            try:
                decoded = base64.urlsafe_b64decode(configured.encode("utf-8"))
                if len(decoded) == 32:
                    return configured.encode("utf-8")
            except Exception:
                pass

            digest = hashlib.sha256(configured.encode("utf-8")).digest()
            return base64.urlsafe_b64encode(digest)

        logger.warning(
            "AI_SECRETS_MASTER_KEY not set. Using ephemeral in-memory encryption key for AI secrets. "
            "Persisted secrets will not be decryptable after restart."
        )
        return self._ephemeral_key

    def encrypt(self, raw: str) -> str:
        try:
            return self._fernet.encrypt(raw.encode("utf-8")).decode("utf-8")
        except Exception as exc:
            raise SecretEncryptionError("Failed to encrypt AI secret") from exc

    def decrypt(self, encrypted: str) -> str:
        try:
            return self._fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise SecretEncryptionError("Failed to decrypt AI secret with current key") from exc

    def upsert_workspace_secrets(self, db: Session, workspace_id: int, secrets: Dict[str, str]) -> int:
        now = datetime.utcnow()
        count = 0
        for key, value in secrets.items():
            if not key:
                continue

            existing = (
                db.query(db_models.AiWorkspaceSecret)
                .filter(
                    db_models.AiWorkspaceSecret.workspace_id == workspace_id,
                    db_models.AiWorkspaceSecret.secret_key == key,
                )
                .first()
            )
            encrypted = self.encrypt(value)
            if existing:
                existing.encrypted_value = encrypted
                existing.updated_at = now
                existing.is_active = True
            else:
                db.add(
                    db_models.AiWorkspaceSecret(
                        workspace_id=workspace_id,
                        secret_key=key,
                        encrypted_value=encrypted,
                        is_active=True,
                        created_at=now,
                        updated_at=now,
                    )
                )
            count += 1
        db.commit()
        return count

    def get_workspace_secret(
        self,
        db: Session,
        workspace_id: int,
        secret_key: str,
        *,
        env_fallback: bool = True,
    ) -> Optional[str]:
        row = (
            db.query(db_models.AiWorkspaceSecret)
            .filter(
                db_models.AiWorkspaceSecret.workspace_id == workspace_id,
                db_models.AiWorkspaceSecret.secret_key == secret_key,
                db_models.AiWorkspaceSecret.is_active.is_(True),
            )
            .first()
        )
        if row:
            return self.decrypt(row.encrypted_value)

        if not env_fallback:
            return None

        env_name = DEFAULT_ENV_FALLBACKS.get(secret_key, secret_key.upper())
        value = os.getenv(env_name)
        return value if value else None

    def has_secret(
        self,
        db: Session,
        workspace_id: int,
        secret_key: str,
    ) -> bool:
        return bool(self.get_workspace_secret(db, workspace_id, secret_key, env_fallback=True))

    def list_secret_keys(self, db: Session, workspace_id: int) -> list[str]:
        rows = (
            db.query(db_models.AiWorkspaceSecret.secret_key)
            .filter(
                db_models.AiWorkspaceSecret.workspace_id == workspace_id,
                db_models.AiWorkspaceSecret.is_active.is_(True),
            )
            .all()
        )
        return [row[0] for row in rows]
