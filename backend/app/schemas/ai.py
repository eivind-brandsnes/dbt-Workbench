from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AiSettingsResponse(BaseModel):
    enabled: bool
    default_mode: str
    default_direct_provider: str
    default_model_openai: Optional[str] = None
    default_model_anthropic: Optional[str] = None
    default_model_gemini: Optional[str] = None
    allow_session_provider_override: bool
    allow_data_context_results: bool
    allow_data_context_run_logs: bool
    ai_system_enabled: bool
    available_direct_providers: List[str] = Field(default_factory=lambda: ["openai", "anthropic", "gemini"])
    has_direct_credentials: Dict[str, bool] = Field(default_factory=dict)
    mcp_server_count: int = 0


class AiSettingsUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    default_mode: Optional[str] = None
    default_direct_provider: Optional[str] = None
    default_model_openai: Optional[str] = None
    default_model_anthropic: Optional[str] = None
    default_model_gemini: Optional[str] = None
    allow_session_provider_override: Optional[bool] = None
    allow_data_context_results: Optional[bool] = None
    allow_data_context_run_logs: Optional[bool] = None


class AiSecretsUpdateRequest(BaseModel):
    secrets: Dict[str, str] = Field(default_factory=dict)


class AiSecretsUpdateResponse(BaseModel):
    updated_count: int
    updated_keys: List[str]


class AiMcpTemplateResponse(BaseModel):
    templates: Dict[str, Dict[str, Any]]


class AiMcpServerBase(BaseModel):
    name: str
    mode: str
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)
    secret_refs: List[str] = Field(default_factory=list)


class AiMcpServerCreate(AiMcpServerBase):
    pass


class AiMcpServerUpdate(BaseModel):
    name: Optional[str] = None
    mode: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None
    secret_refs: Optional[List[str]] = None


class AiMcpServerResponse(AiMcpServerBase):
    id: int
    workspace_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AiConversationCreateRequest(BaseModel):
    title: str = "New conversation"
    meta: Dict[str, Any] = Field(default_factory=dict)


class AiConversationResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: Optional[int] = None
    title: str
    meta: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AiMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    workspace_id: int
    conversation_id: int
    user_id: Optional[int] = None
    role: str
    content: str
    provider_mode: Optional[str] = None
    provider_name: Optional[str] = None
    model_name: Optional[str] = None
    message_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class AiProviderOverride(BaseModel):
    mode: Optional[str] = None
    direct_provider: Optional[str] = None
    model_name: Optional[str] = None
    mcp_server_id: Optional[int] = None


class AiChatContextRequest(BaseModel):
    sql_metadata: bool = False
    compiled_model_id: Optional[str] = None
    environment_id: Optional[int] = None
    sql_history: bool = False
    history_limit: int = 5
    lineage_graph: bool = False
    lineage_max_depth: Optional[int] = None
    lineage_node_id: Optional[str] = None
    lineage_column: Optional[str] = None
    run_id: Optional[str] = None
    run_logs: bool = False
    run_logs_limit: int = 200
    catalog_query: Optional[str] = None
    git_file_path: Optional[str] = None


class AiChatStreamRequest(BaseModel):
    prompt: str
    conversation_id: Optional[int] = None
    conversation_title: Optional[str] = None
    context: AiChatContextRequest = Field(default_factory=AiChatContextRequest)
    provider_override: Optional[AiProviderOverride] = None


class AiActionProposalResponse(BaseModel):
    proposal_id: str
    proposal_type: str
    status: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    risk_flags: List[str] = Field(default_factory=list)
    result_payload: Dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[datetime] = None


class AiActionResolveResponse(BaseModel):
    proposal_id: str
    status: str
    result: Dict[str, Any] = Field(default_factory=dict)
