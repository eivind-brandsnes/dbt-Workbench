from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.models import models as db_models
from app.services.audit_service import record_audit


class AiAuditService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()

    def get_or_create_workspace_settings(self, db: Session, workspace_id: int) -> db_models.AiWorkspaceSetting:
        setting = (
            db.query(db_models.AiWorkspaceSetting)
            .filter(db_models.AiWorkspaceSetting.workspace_id == workspace_id)
            .first()
        )
        if setting:
            return setting

        now = datetime.utcnow()
        setting = db_models.AiWorkspaceSetting(
            workspace_id=workspace_id,
            enabled=self.settings.ai_enabled,
            default_mode=self.settings.ai_default_mode,
            default_direct_provider=self.settings.ai_default_direct_provider,
            default_model_openai=self.settings.ai_default_direct_model_openai,
            default_model_anthropic=self.settings.ai_default_direct_model_anthropic,
            default_model_gemini=self.settings.ai_default_direct_model_gemini,
            allow_session_provider_override=self.settings.ai_allow_session_provider_override,
            allow_data_context_results=True,
            allow_data_context_run_logs=True,
            created_at=now,
            updated_at=now,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting

    def update_workspace_settings(
        self,
        db: Session,
        workspace_id: int,
        payload: Dict[str, Any],
    ) -> db_models.AiWorkspaceSetting:
        setting = self.get_or_create_workspace_settings(db, workspace_id)
        now = datetime.utcnow()

        updates = {
            "enabled": payload.get("enabled"),
            "default_mode": payload.get("default_mode"),
            "default_direct_provider": payload.get("default_direct_provider"),
            "default_model_openai": payload.get("default_model_openai"),
            "default_model_anthropic": payload.get("default_model_anthropic"),
            "default_model_gemini": payload.get("default_model_gemini"),
            "allow_session_provider_override": payload.get("allow_session_provider_override"),
            "allow_data_context_results": payload.get("allow_data_context_results"),
            "allow_data_context_run_logs": payload.get("allow_data_context_run_logs"),
        }
        for key, value in updates.items():
            if value is not None:
                setattr(setting, key, value)

        setting.updated_at = now
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting

    def create_conversation(
        self,
        db: Session,
        workspace_id: int,
        *,
        user_id: Optional[int],
        title: str,
        meta: Optional[Dict[str, Any]] = None,
    ) -> db_models.AiConversation:
        now = datetime.utcnow()
        conv = db_models.AiConversation(
            workspace_id=workspace_id,
            user_id=user_id,
            title=title or "New conversation",
            meta=meta or {},
            created_at=now,
            updated_at=now,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    def list_conversations(
        self,
        db: Session,
        workspace_id: int,
        *,
        user_id: Optional[int],
        auth_enabled: bool,
    ) -> List[db_models.AiConversation]:
        query = db.query(db_models.AiConversation).filter(db_models.AiConversation.workspace_id == workspace_id)
        if auth_enabled and user_id is not None:
            query = query.filter(db_models.AiConversation.user_id == user_id)
        return query.order_by(db_models.AiConversation.updated_at.desc()).limit(200).all()

    def get_conversation(
        self,
        db: Session,
        workspace_id: int,
        conversation_id: int,
    ) -> Optional[db_models.AiConversation]:
        return (
            db.query(db_models.AiConversation)
            .filter(
                db_models.AiConversation.id == conversation_id,
                db_models.AiConversation.workspace_id == workspace_id,
            )
            .first()
        )

    def list_messages(
        self,
        db: Session,
        workspace_id: int,
        conversation_id: int,
    ) -> List[db_models.AiMessage]:
        return (
            db.query(db_models.AiMessage)
            .filter(
                db_models.AiMessage.workspace_id == workspace_id,
                db_models.AiMessage.conversation_id == conversation_id,
            )
            .order_by(db_models.AiMessage.created_at.asc())
            .all()
        )

    def add_message(
        self,
        db: Session,
        *,
        workspace_id: int,
        conversation_id: int,
        user_id: Optional[int],
        role: str,
        content: str,
        provider_mode: Optional[str] = None,
        provider_name: Optional[str] = None,
        model_name: Optional[str] = None,
        message_metadata: Optional[Dict[str, Any]] = None,
    ) -> db_models.AiMessage:
        now = datetime.utcnow()
        row = db_models.AiMessage(
            workspace_id=workspace_id,
            conversation_id=conversation_id,
            user_id=user_id,
            role=role,
            content=content,
            provider_mode=provider_mode,
            provider_name=provider_name,
            model_name=model_name,
            message_metadata=message_metadata or {},
            created_at=now,
        )
        db.add(row)

        conversation = self.get_conversation(db, workspace_id, conversation_id)
        if conversation:
            conversation.updated_at = now
            db.add(conversation)

        db.commit()
        db.refresh(row)
        return row

    def add_tool_trace(
        self,
        db: Session,
        *,
        workspace_id: int,
        conversation_id: int,
        message_id: Optional[int],
        tool_name: str,
        status: str,
        input_payload: Dict[str, Any],
        output_payload: Dict[str, Any],
        error_message: Optional[str] = None,
    ) -> db_models.AiToolTrace:
        trace = db_models.AiToolTrace(
            workspace_id=workspace_id,
            conversation_id=conversation_id,
            message_id=message_id,
            tool_name=tool_name,
            status=status,
            input_payload=input_payload,
            output_payload=output_payload,
            error_message=error_message,
            created_at=datetime.utcnow(),
        )
        db.add(trace)
        db.commit()
        db.refresh(trace)
        return trace

    def create_action_proposal(
        self,
        db: Session,
        *,
        workspace_id: int,
        conversation_id: int,
        message_id: Optional[int],
        created_by_user_id: Optional[int],
        proposal_type: str,
        payload: Dict[str, Any],
        risk_flags: List[str],
        ttl_minutes: int = 15,
    ) -> db_models.AiActionProposal:
        now = datetime.utcnow()
        proposal = db_models.AiActionProposal(
            proposal_id=str(uuid4()),
            workspace_id=workspace_id,
            conversation_id=conversation_id,
            message_id=message_id,
            created_by_user_id=created_by_user_id,
            proposal_type=proposal_type,
            status="pending",
            payload=payload,
            risk_flags=risk_flags,
            result_payload={},
            expires_at=now + timedelta(minutes=ttl_minutes),
            created_at=now,
            updated_at=now,
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal

    def get_action_proposal(self, db: Session, workspace_id: int, proposal_id: str) -> Optional[db_models.AiActionProposal]:
        return (
            db.query(db_models.AiActionProposal)
            .filter(
                db_models.AiActionProposal.workspace_id == workspace_id,
                db_models.AiActionProposal.proposal_id == proposal_id,
            )
            .first()
        )

    def update_action_status(
        self,
        db: Session,
        *,
        proposal: db_models.AiActionProposal,
        status: str,
        result_payload: Optional[Dict[str, Any]] = None,
        confirmed_by_user_id: Optional[int] = None,
    ) -> db_models.AiActionProposal:
        now = datetime.utcnow()
        proposal.status = status
        proposal.updated_at = now
        if result_payload is not None:
            proposal.result_payload = result_payload
        if confirmed_by_user_id is not None:
            proposal.confirmed_by_user_id = confirmed_by_user_id
            proposal.confirmed_at = now
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        return proposal

    def record_action_audit(
        self,
        db: Session,
        *,
        workspace_id: int,
        user_id: Optional[int],
        username: Optional[str],
        action: str,
        resource: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        record_audit(
            db,
            workspace_id=workspace_id,
            user_id=user_id,
            username=username,
            action=action,
            resource=resource,
            metadata=metadata or {},
        )
