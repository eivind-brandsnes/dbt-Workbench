from __future__ import annotations

import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.core.auth import (
    Role,
    UserContext,
    WorkspaceContext,
    get_current_user,
    get_current_workspace,
    require_role,
)
from app.core.config import get_settings
from app.database.connection import SessionLocal
from app.database.models import models as db_models
from app.schemas.ai import (
    AiActionResolveResponse,
    AiActionProposalResponse,
    AiChatStreamRequest,
    AiConversationCreateRequest,
    AiConversationResponse,
    AiMcpServerCreate,
    AiMcpServerResponse,
    AiMcpServerUpdate,
    AiMcpTemplateResponse,
    AiMessageResponse,
    AiSecretsUpdateRequest,
    AiSecretsUpdateResponse,
    AiSettingsResponse,
    AiSettingsUpdateRequest,
)
from app.services.ai.action_service import ActionProposalError, AiActionService
from app.services.ai.audit_service import AiAuditService
from app.services.ai.orchestrator import AiOrchestrator
from app.services.ai.secrets_service import AiSecretsService


router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


orchestrator = AiOrchestrator()
audit_service = AiAuditService()
secrets_service = AiSecretsService()
action_service = AiActionService()


def _assert_conversation_access(
    conversation: db_models.AiConversation,
    *,
    current_user: UserContext,
) -> None:
    if not current_user.auth_enabled:
        return
    if current_user.id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user identity")
    if conversation.user_id is not None and conversation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conversation access denied")


@router.get("/settings", response_model=AiSettingsResponse, dependencies=[Depends(require_role(Role.VIEWER))])
def get_ai_settings(
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
):
    settings = get_settings()
    row = audit_service.get_or_create_workspace_settings(db, workspace.id or 0)
    mcp_count = (
        db.query(db_models.AiMcpServer)
        .filter(
            db_models.AiMcpServer.workspace_id == workspace.id,
            db_models.AiMcpServer.enabled.is_(True),
        )
        .count()
    )

    has_creds = {
        "openai": secrets_service.has_secret(db, workspace.id or 0, "openai_api_key"),
        "anthropic": secrets_service.has_secret(db, workspace.id or 0, "anthropic_api_key"),
        "gemini": secrets_service.has_secret(db, workspace.id or 0, "gemini_api_key"),
    }

    return AiSettingsResponse(
        enabled=row.enabled,
        default_mode=row.default_mode,
        default_direct_provider=row.default_direct_provider,
        default_model_openai=row.default_model_openai,
        default_model_anthropic=row.default_model_anthropic,
        default_model_gemini=row.default_model_gemini,
        allow_session_provider_override=row.allow_session_provider_override,
        allow_data_context_results=row.allow_data_context_results,
        allow_data_context_run_logs=row.allow_data_context_run_logs,
        ai_system_enabled=settings.ai_enabled,
        has_direct_credentials=has_creds,
        mcp_server_count=mcp_count,
    )


@router.put(
    "/settings",
    response_model=AiSettingsResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def update_ai_settings(
    payload: AiSettingsUpdateRequest,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_none=True)
    if updates.get("default_mode") and updates["default_mode"] not in {"direct", "mcp"}:
        raise HTTPException(status_code=400, detail="default_mode must be direct or mcp")
    if updates.get("default_direct_provider") and updates["default_direct_provider"] not in {
        "openai",
        "anthropic",
        "gemini",
    }:
        raise HTTPException(status_code=400, detail="default_direct_provider must be openai|anthropic|gemini")

    row = audit_service.update_workspace_settings(db, workspace.id or 0, updates)
    audit_service.record_action_audit(
        db,
        workspace_id=workspace.id or 0,
        user_id=current_user.id,
        username=current_user.username,
        action="ai.settings.update",
        resource="ai_workspace_settings",
        metadata={"updated_fields": sorted(list(updates.keys()))},
    )

    mcp_count = (
        db.query(db_models.AiMcpServer)
        .filter(
            db_models.AiMcpServer.workspace_id == workspace.id,
            db_models.AiMcpServer.enabled.is_(True),
        )
        .count()
    )

    has_creds = {
        "openai": secrets_service.has_secret(db, workspace.id or 0, "openai_api_key"),
        "anthropic": secrets_service.has_secret(db, workspace.id or 0, "anthropic_api_key"),
        "gemini": secrets_service.has_secret(db, workspace.id or 0, "gemini_api_key"),
    }

    return AiSettingsResponse(
        enabled=row.enabled,
        default_mode=row.default_mode,
        default_direct_provider=row.default_direct_provider,
        default_model_openai=row.default_model_openai,
        default_model_anthropic=row.default_model_anthropic,
        default_model_gemini=row.default_model_gemini,
        allow_session_provider_override=row.allow_session_provider_override,
        allow_data_context_results=row.allow_data_context_results,
        allow_data_context_run_logs=row.allow_data_context_run_logs,
        ai_system_enabled=get_settings().ai_enabled,
        has_direct_credentials=has_creds,
        mcp_server_count=mcp_count,
    )


@router.put(
    "/settings/secrets",
    response_model=AiSecretsUpdateResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def upsert_ai_secrets(
    payload: AiSecretsUpdateRequest,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    if not payload.secrets:
        return AiSecretsUpdateResponse(updated_count=0, updated_keys=[])

    updated = secrets_service.upsert_workspace_secrets(db, workspace.id or 0, payload.secrets)
    audit_service.record_action_audit(
        db,
        workspace_id=workspace.id or 0,
        user_id=current_user.id,
        username=current_user.username,
        action="ai.secrets.update",
        resource="ai_workspace_secrets",
        metadata={"updated_keys": sorted(list(payload.secrets.keys()))},
    )
    return AiSecretsUpdateResponse(updated_count=updated, updated_keys=sorted(list(payload.secrets.keys())))


@router.get(
    "/mcp/templates",
    response_model=AiMcpTemplateResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def list_mcp_templates():
    raw = get_settings().ai_mcp_local_allowlist_json or "{}"
    try:
        templates = json.loads(raw)
        if not isinstance(templates, dict):
            templates = {}
    except Exception:
        templates = {}
    return AiMcpTemplateResponse(templates=templates)


@router.get("/mcp/servers", response_model=List[AiMcpServerResponse], dependencies=[Depends(require_role(Role.VIEWER))])
def list_mcp_servers(
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
):
    rows = (
        db.query(db_models.AiMcpServer)
        .filter(db_models.AiMcpServer.workspace_id == workspace.id)
        .order_by(db_models.AiMcpServer.id.asc())
        .all()
    )
    return [AiMcpServerResponse.model_validate(row) for row in rows]


@router.post(
    "/mcp/servers",
    response_model=AiMcpServerResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def create_mcp_server(
    payload: AiMcpServerCreate,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    if payload.mode not in {"remote_http", "remote_sse", "local_stdio"}:
        raise HTTPException(status_code=400, detail="mode must be remote_http|remote_sse|local_stdio")

    now = datetime.utcnow()
    row = db_models.AiMcpServer(
        workspace_id=workspace.id or 0,
        name=payload.name,
        mode=payload.mode,
        enabled=payload.enabled,
        config=payload.config,
        secret_refs=payload.secret_refs,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    audit_service.record_action_audit(
        db,
        workspace_id=workspace.id or 0,
        user_id=current_user.id,
        username=current_user.username,
        action="ai.mcp_server.create",
        resource="ai_mcp_servers",
        metadata={"server_id": row.id, "mode": row.mode},
    )
    return AiMcpServerResponse.model_validate(row)


@router.put(
    "/mcp/servers/{server_id}",
    response_model=AiMcpServerResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def update_mcp_server(
    server_id: int,
    payload: AiMcpServerUpdate,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    row = (
        db.query(db_models.AiMcpServer)
        .filter(
            db_models.AiMcpServer.workspace_id == workspace.id,
            db_models.AiMcpServer.id == server_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="MCP server not found")

    updates = payload.model_dump(exclude_none=True)
    if "mode" in updates and updates["mode"] not in {"remote_http", "remote_sse", "local_stdio"}:
        raise HTTPException(status_code=400, detail="mode must be remote_http|remote_sse|local_stdio")

    for key, value in updates.items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)

    audit_service.record_action_audit(
        db,
        workspace_id=workspace.id or 0,
        user_id=current_user.id,
        username=current_user.username,
        action="ai.mcp_server.update",
        resource="ai_mcp_servers",
        metadata={"server_id": row.id, "updated_fields": sorted(list(updates.keys()))},
    )
    return AiMcpServerResponse.model_validate(row)


@router.delete(
    "/mcp/servers/{server_id}",
    dependencies=[Depends(require_role(Role.ADMIN))],
)
def delete_mcp_server(
    server_id: int,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    row = (
        db.query(db_models.AiMcpServer)
        .filter(
            db_models.AiMcpServer.workspace_id == workspace.id,
            db_models.AiMcpServer.id == server_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="MCP server not found")

    db.delete(row)
    db.commit()

    audit_service.record_action_audit(
        db,
        workspace_id=workspace.id or 0,
        user_id=current_user.id,
        username=current_user.username,
        action="ai.mcp_server.delete",
        resource="ai_mcp_servers",
        metadata={"server_id": server_id},
    )
    return {"message": "deleted"}


@router.get("/conversations", response_model=List[AiConversationResponse], dependencies=[Depends(require_role(Role.VIEWER))])
def list_conversations(
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    rows = audit_service.list_conversations(
        db,
        workspace.id or 0,
        user_id=current_user.id,
        auth_enabled=current_user.auth_enabled,
    )
    return [AiConversationResponse.model_validate(row) for row in rows]


@router.post("/conversations", response_model=AiConversationResponse, dependencies=[Depends(require_role(Role.VIEWER))])
def create_conversation(
    payload: AiConversationCreateRequest,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    row = audit_service.create_conversation(
        db,
        workspace.id or 0,
        user_id=current_user.id if current_user.auth_enabled else None,
        title=payload.title,
        meta=payload.meta,
    )
    return AiConversationResponse.model_validate(row)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[AiMessageResponse],
    dependencies=[Depends(require_role(Role.VIEWER))],
)
def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    conversation = audit_service.get_conversation(db, workspace.id or 0, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_conversation_access(conversation, current_user=current_user)

    rows = audit_service.list_messages(db, workspace.id or 0, conversation_id)
    return [AiMessageResponse.model_validate(row) for row in rows]


@router.post("/chat/stream", dependencies=[Depends(require_role(Role.VIEWER))])
async def chat_stream(
    payload: AiChatStreamRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    conversation = None
    if payload.conversation_id is not None:
        conversation = audit_service.get_conversation(db, workspace.id or 0, payload.conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        _assert_conversation_access(conversation, current_user=current_user)
    else:
        conversation = audit_service.create_conversation(
            db,
            workspace.id or 0,
            user_id=current_user.id if current_user.auth_enabled else None,
            title=payload.conversation_title or "New conversation",
            meta={},
        )

    conversation_id = conversation.id

    audit_service.add_message(
        db,
        workspace_id=workspace.id or 0,
        conversation_id=conversation_id,
        user_id=current_user.id if current_user.auth_enabled else None,
        role="user",
        content=payload.prompt,
        message_metadata={"context": payload.context.model_dump()},
    )

    async def event_generator():
        try:
            async for event in orchestrator.stream_chat(
                db=db,
                workspace=workspace,
                user_id=current_user.id if current_user.auth_enabled else None,
                username=current_user.username,
                conversation_id=conversation_id,
                prompt=payload.prompt,
                requested_context=payload.context.model_dump(),
                provider_override=payload.provider_override.model_dump(exclude_none=True)
                if payload.provider_override
                else None,
            ):
                yield {
                    "event": event.event,
                    "data": json.dumps(event.data),
                }
        except Exception as exc:
            yield {
                "event": "error",
                "data": json.dumps({"message": str(exc)}),
            }
        finally:
            yield {
                "event": "end",
                "data": json.dumps({"conversation_id": conversation_id}),
            }

    return EventSourceResponse(event_generator())


@router.post(
    "/actions/{proposal_id}/confirm",
    response_model=AiActionResolveResponse,
    dependencies=[Depends(require_role(Role.DEVELOPER))],
)
async def confirm_action(
    proposal_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    proposal = audit_service.get_action_proposal(db, workspace.id or 0, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.expires_at and proposal.expires_at < datetime.utcnow() and proposal.status == "pending":
        audit_service.update_action_status(db, proposal=proposal, status="expired", result_payload={"message": "Expired"})

    try:
        result = await action_service.confirm_and_execute(
            db=db,
            workspace=workspace,
            proposal=proposal,
            user_id=current_user.id if current_user.auth_enabled else None,
            username=current_user.username,
            background_tasks=background_tasks,
        )
    except ActionProposalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to execute proposal: {exc}") from exc

    updated = audit_service.get_action_proposal(db, workspace.id or 0, proposal_id)
    return AiActionResolveResponse(
        proposal_id=proposal_id,
        status=updated.status if updated else "executed",
        result=result,
    )


@router.post(
    "/actions/{proposal_id}/reject",
    response_model=AiActionResolveResponse,
    dependencies=[Depends(require_role(Role.VIEWER))],
)
def reject_action(
    proposal_id: str,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
    current_user: UserContext = Depends(get_current_user),
):
    proposal = audit_service.get_action_proposal(db, workspace.id or 0, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.expires_at and proposal.expires_at < datetime.utcnow() and proposal.status == "pending":
        audit_service.update_action_status(db, proposal=proposal, status="expired", result_payload={"message": "Expired"})

    try:
        result = action_service.reject(
            db=db,
            workspace=workspace,
            proposal=proposal,
            user_id=current_user.id if current_user.auth_enabled else None,
            username=current_user.username,
        )
    except ActionProposalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = audit_service.get_action_proposal(db, workspace.id or 0, proposal_id)
    return AiActionResolveResponse(
        proposal_id=proposal_id,
        status=updated.status if updated else "rejected",
        result=result,
    )


@router.get(
    "/actions/{proposal_id}",
    response_model=AiActionProposalResponse,
    dependencies=[Depends(require_role(Role.VIEWER))],
)
def get_action(
    proposal_id: str,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(get_current_workspace),
):
    proposal = audit_service.get_action_proposal(db, workspace.id or 0, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return AiActionProposalResponse(
        proposal_id=proposal.proposal_id,
        proposal_type=proposal.proposal_type,
        status=proposal.status,
        payload=proposal.payload or {},
        risk_flags=proposal.risk_flags or [],
        result_payload=proposal.result_payload or {},
        expires_at=proposal.expires_at,
    )
