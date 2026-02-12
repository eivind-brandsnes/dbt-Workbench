from __future__ import annotations

import json
import logging
import re
from typing import Any, AsyncIterator, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.auth import WorkspaceContext
from app.core.config import Settings, get_settings
from app.database.models import models as db_models
from app.services.ai.audit_service import AiAuditService
from app.services.ai.context_service import AiContextService
from app.services.ai.provider_base import AiEvent, AiProviderRequest
from app.services.ai.providers import AnthropicProvider, GeminiProvider, McpProvider, OpenAIProvider
from app.services.ai.secrets_service import AiSecretsService

logger = logging.getLogger(__name__)


class AiOrchestrator:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.audit = AiAuditService(self.settings)
        self.context_service = AiContextService(self.settings)
        self.secrets = AiSecretsService(self.settings)

    async def stream_chat(
        self,
        *,
        db: Session,
        workspace: WorkspaceContext,
        user_id: Optional[int],
        username: Optional[str],
        conversation_id: int,
        prompt: str,
        requested_context: Dict[str, Any],
        provider_override: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[AiEvent]:
        setting = self.audit.get_or_create_workspace_settings(db, workspace.id or 0)
        runtime = self._resolve_runtime(setting, provider_override or {})

        context_payload = self.context_service.build_context(
            workspace=workspace,
            db=db,
            requested=requested_context,
        )
        self.audit.add_tool_trace(
            db,
            workspace_id=workspace.id or 0,
            conversation_id=conversation_id,
            message_id=None,
            tool_name="context.build",
            status="ok",
            input_payload=requested_context,
            output_payload={"keys": list(context_payload.keys())},
        )

        message_rows = self.audit.list_messages(db, workspace.id or 0, conversation_id)
        historical_messages = [
            {"role": row.role, "content": row.content}
            for row in message_rows[-20:]
            if row.role in {"user", "assistant", "system"}
        ]

        system_prompt = self._build_system_prompt(runtime, requested_context)
        if not historical_messages or historical_messages[0].get("role") != "system":
            historical_messages.insert(0, {"role": "system", "content": system_prompt})

        provider_request = AiProviderRequest(
            prompt=prompt,
            conversation_id=conversation_id,
            workspace_id=workspace.id or 0,
            provider_mode=runtime["mode"],
            provider_name=runtime["provider_name"],
            model_name=runtime.get("model_name"),
            context=context_payload,
            messages=historical_messages,
        )

        provider = self._build_provider(db=db, workspace_id=workspace.id or 0, runtime=runtime)

        yield AiEvent(
            event="meta",
            data={
                "conversation_id": conversation_id,
                "provider_mode": runtime["mode"],
                "provider_name": runtime["provider_name"],
                "model_name": runtime.get("model_name"),
            },
        )

        buffer: List[str] = []
        async for event in provider.stream_chat(provider_request):
            if event.event == "token":
                text = str(event.data.get("text", ""))
                buffer.append(text)
            yield event

        assistant_text = "".join(buffer).strip() or "No response generated."
        assistant_message = self.audit.add_message(
            db,
            workspace_id=workspace.id or 0,
            conversation_id=conversation_id,
            user_id=None,
            role="assistant",
            content=assistant_text,
            provider_mode=runtime["mode"],
            provider_name=runtime["provider_name"],
            model_name=runtime.get("model_name"),
            message_metadata={"context_keys": list(context_payload.keys())},
        )

        proposals = self._extract_action_proposals(
            prompt=prompt,
            assistant_text=assistant_text,
            requested_context=requested_context,
        )
        for proposal in proposals:
            row = self.audit.create_action_proposal(
                db,
                workspace_id=workspace.id or 0,
                conversation_id=conversation_id,
                message_id=assistant_message.id,
                created_by_user_id=user_id,
                proposal_type=proposal["proposal_type"],
                payload=proposal["payload"],
                risk_flags=proposal["risk_flags"],
            )
            yield AiEvent(
                event="proposal",
                data={
                    "proposal_id": row.proposal_id,
                    "proposal_type": row.proposal_type,
                    "payload": row.payload,
                    "risk_flags": row.risk_flags,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                },
            )

        self.audit.record_action_audit(
            db,
            workspace_id=workspace.id or 0,
            user_id=user_id,
            username=username,
            action="ai.chat",
            resource="conversation",
            metadata={
                "conversation_id": conversation_id,
                "provider_mode": runtime["mode"],
                "provider_name": runtime["provider_name"],
                "has_proposals": bool(proposals),
            },
        )

        yield AiEvent(
            event="done",
            data={
                "conversation_id": conversation_id,
                "message_id": assistant_message.id,
            },
        )

    def _resolve_runtime(
        self,
        setting: db_models.AiWorkspaceSetting,
        override: Dict[str, Any],
    ) -> Dict[str, Any]:
        mode = str(override.get("mode") or setting.default_mode or self.settings.ai_default_mode)
        if mode not in {"direct", "mcp"}:
            mode = "direct"

        direct_provider = str(
            override.get("direct_provider")
            or setting.default_direct_provider
            or self.settings.ai_default_direct_provider
        )
        if direct_provider not in {"openai", "anthropic", "gemini"}:
            direct_provider = "openai"

        model_name = override.get("model_name")
        if not model_name:
            if direct_provider == "openai":
                model_name = setting.default_model_openai or self.settings.ai_default_direct_model_openai
            elif direct_provider == "anthropic":
                model_name = setting.default_model_anthropic or self.settings.ai_default_direct_model_anthropic
            else:
                model_name = setting.default_model_gemini or self.settings.ai_default_direct_model_gemini

        mcp_server_id = override.get("mcp_server_id")

        return {
            "mode": mode,
            "provider_name": direct_provider if mode == "direct" else "mcp",
            "direct_provider": direct_provider,
            "model_name": model_name,
            "mcp_server_id": mcp_server_id,
        }

    def _build_provider(self, *, db: Session, workspace_id: int, runtime: Dict[str, Any]):
        mode = runtime["mode"]
        if mode == "direct":
            provider = runtime["direct_provider"]
            if provider == "openai":
                api_key = self.secrets.get_workspace_secret(db, workspace_id, "openai_api_key")
                return OpenAIProvider(api_key=api_key)
            if provider == "anthropic":
                api_key = self.secrets.get_workspace_secret(db, workspace_id, "anthropic_api_key")
                return AnthropicProvider(api_key=api_key)

            api_key = self.secrets.get_workspace_secret(db, workspace_id, "gemini_api_key")
            return GeminiProvider(api_key=api_key)

        mcp_server = self._resolve_mcp_server(db, workspace_id, runtime.get("mcp_server_id"))
        if mcp_server is None:
            raise RuntimeError("No enabled MCP server configured for workspace")

        secret_values: Dict[str, str] = {}
        refs = mcp_server.secret_refs if isinstance(mcp_server.secret_refs, list) else []
        for secret_key in refs:
            if isinstance(secret_key, str):
                value = self.secrets.get_workspace_secret(db, workspace_id, secret_key)
                if value:
                    secret_values[secret_key] = value

        cfg = mcp_server.config if isinstance(mcp_server.config, dict) else {}
        header_refs = cfg.get("header_secrets")
        if isinstance(header_refs, list):
            for item in header_refs:
                if isinstance(item, dict) and item.get("secret_key"):
                    secret_key = str(item["secret_key"])
                    value = self.secrets.get_workspace_secret(db, workspace_id, secret_key)
                    if value:
                        secret_values[secret_key] = value

        return McpProvider(
            workspace_id=workspace_id,
            mcp_server_id=mcp_server.id,
            server_mode=mcp_server.mode,
            server_config=cfg,
            secret_values=secret_values,
            settings=self.settings,
        )

    def _resolve_mcp_server(
        self,
        db: Session,
        workspace_id: int,
        requested_server_id: Optional[int],
    ) -> Optional[db_models.AiMcpServer]:
        query = db.query(db_models.AiMcpServer).filter(
            db_models.AiMcpServer.workspace_id == workspace_id,
            db_models.AiMcpServer.enabled.is_(True),
        )
        if requested_server_id is not None:
            return query.filter(db_models.AiMcpServer.id == requested_server_id).first()
        return query.order_by(db_models.AiMcpServer.id.asc()).first()

    def _build_system_prompt(self, runtime: Dict[str, Any], requested_context: Dict[str, Any]) -> str:
        return (
            "You are dbt-Workbench AI Copilot. Provide concise, accurate guidance for dbt workflows. "
            "If suggesting executable actions, include clear confirmation language before execution. "
            f"Mode={runtime['mode']}; provider={runtime['provider_name']}; "
            f"context_flags={json.dumps(sorted(requested_context.keys()))}."
        )

    def _extract_action_proposals(
        self,
        *,
        prompt: str,
        assistant_text: str,
        requested_context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        proposals: List[Dict[str, Any]] = []

        sql = self._extract_sql_block(assistant_text)
        if sql and self._should_propose_sql(prompt):
            risk_flags = self._sql_risk_flags(sql)
            proposals.append(
                {
                    "proposal_type": "sql_execute",
                    "payload": {
                        "sql": sql,
                        "environment_id": requested_context.get("environment_id"),
                    },
                    "risk_flags": risk_flags,
                }
            )

        dbt_cmd = self._extract_dbt_command(assistant_text)
        if dbt_cmd and self._should_propose_dbt(prompt):
            proposals.append(
                {
                    "proposal_type": "dbt_run",
                    "payload": {
                        "command": dbt_cmd,
                        "parameters": {},
                    },
                    "risk_flags": ["requires_confirmation"],
                }
            )

        return proposals

    def _extract_sql_block(self, text: str) -> Optional[str]:
        block_match = re.search(r"```sql\s*(.*?)```", text, flags=re.IGNORECASE | re.DOTALL)
        if block_match:
            return block_match.group(1).strip()

        if text.strip().lower().startswith("select "):
            return text.strip()
        return None

    def _extract_dbt_command(self, text: str) -> Optional[str]:
        match = re.search(r"\bdbt\s+(run|test|seed|deps|docs\s+generate)\b", text, flags=re.IGNORECASE)
        if not match:
            return None
        cmd = match.group(1).lower().strip()
        cmd = "docs generate" if cmd.startswith("docs") else cmd
        return cmd

    def _should_propose_sql(self, prompt: str) -> bool:
        lower = prompt.lower()
        keywords = ["run sql", "execute sql", "execute this", "query", "run this query"]
        return any(k in lower for k in keywords)

    def _should_propose_dbt(self, prompt: str) -> bool:
        lower = prompt.lower()
        return "dbt" in lower and any(word in lower for word in ["run", "execute", "trigger"])

    def _sql_risk_flags(self, sql: str) -> List[str]:
        flags = ["requires_confirmation"]
        lowered = sql.lower()
        destructive = ["drop ", "truncate ", "delete ", "alter ", "create "]
        if any(token in lowered for token in destructive):
            flags.append("destructive")
        return flags
