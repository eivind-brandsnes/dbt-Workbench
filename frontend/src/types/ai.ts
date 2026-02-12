export type AiMode = 'direct' | 'mcp'
export type AiDirectProvider = 'openai' | 'anthropic' | 'gemini'

export interface AiSettings {
  enabled: boolean
  default_mode: AiMode
  default_direct_provider: AiDirectProvider
  default_model_openai?: string | null
  default_model_anthropic?: string | null
  default_model_gemini?: string | null
  allow_session_provider_override: boolean
  allow_data_context_results: boolean
  allow_data_context_run_logs: boolean
  ai_system_enabled: boolean
  available_direct_providers: AiDirectProvider[]
  has_direct_credentials: Record<string, boolean>
  mcp_server_count: number
}

export interface AiSettingsUpdate {
  enabled?: boolean
  default_mode?: AiMode
  default_direct_provider?: AiDirectProvider
  default_model_openai?: string
  default_model_anthropic?: string
  default_model_gemini?: string
  allow_session_provider_override?: boolean
  allow_data_context_results?: boolean
  allow_data_context_run_logs?: boolean
}

export interface AiSecretsUpdateRequest {
  secrets: Record<string, string>
}

export interface AiSecretsUpdateResponse {
  updated_count: number
  updated_keys: string[]
}

export interface AiMcpServer {
  id: number
  workspace_id: number
  name: string
  mode: 'remote_http' | 'remote_sse' | 'local_stdio'
  enabled: boolean
  config: Record<string, any>
  secret_refs: string[]
  created_at?: string | null
  updated_at?: string | null
}

export interface AiMcpServerCreate {
  name: string
  mode: 'remote_http' | 'remote_sse' | 'local_stdio'
  enabled?: boolean
  config?: Record<string, any>
  secret_refs?: string[]
}

export interface AiMcpServerUpdate {
  name?: string
  mode?: 'remote_http' | 'remote_sse' | 'local_stdio'
  enabled?: boolean
  config?: Record<string, any>
  secret_refs?: string[]
}

export interface AiConversation {
  id: number
  workspace_id: number
  user_id?: number | null
  title: string
  meta: Record<string, any>
  created_at?: string | null
  updated_at?: string | null
}

export interface AiMessage {
  id: number
  workspace_id: number
  conversation_id: number
  user_id?: number | null
  role: 'user' | 'assistant' | 'system'
  content: string
  provider_mode?: string | null
  provider_name?: string | null
  model_name?: string | null
  message_metadata: Record<string, any>
  created_at?: string | null
}

export interface AiProviderOverride {
  mode?: AiMode
  direct_provider?: AiDirectProvider
  model_name?: string
  mcp_server_id?: number
}

export interface AiChatContext {
  sql_metadata?: boolean
  compiled_model_id?: string
  environment_id?: number
  sql_history?: boolean
  history_limit?: number
  lineage_graph?: boolean
  lineage_max_depth?: number
  lineage_node_id?: string
  lineage_column?: string
  run_id?: string
  run_logs?: boolean
  run_logs_limit?: number
  catalog_query?: string
  git_file_path?: string
}

export interface AiChatStreamRequest {
  prompt: string
  conversation_id?: number
  conversation_title?: string
  context?: AiChatContext
  provider_override?: AiProviderOverride
}

export interface AiActionProposal {
  proposal_id: string
  proposal_type: 'sql_execute' | 'dbt_run' | string
  status: string
  payload: Record<string, any>
  risk_flags: string[]
  result_payload: Record<string, any>
  expires_at?: string | null
}

export interface AiActionResolveResponse {
  proposal_id: string
  status: string
  result: Record<string, any>
}

export interface AiStreamMetaEvent {
  event: 'meta'
  data: {
    conversation_id: number
    provider_mode: string
    provider_name: string
    model_name?: string | null
  }
}

export interface AiStreamTokenEvent {
  event: 'token'
  data: {
    text: string
  }
}

export interface AiStreamProposalEvent {
  event: 'proposal'
  data: {
    proposal_id: string
    proposal_type: string
    payload: Record<string, any>
    risk_flags: string[]
    expires_at?: string | null
  }
}

export interface AiStreamDoneEvent {
  event: 'done'
  data: {
    conversation_id: number
    message_id?: number
  }
}

export interface AiStreamErrorEvent {
  event: 'error'
  data: {
    message: string
  }
}

export interface AiStreamEndEvent {
  event: 'end'
  data: {
    conversation_id: number
  }
}

export type AiStreamEvent =
  | AiStreamMetaEvent
  | AiStreamTokenEvent
  | AiStreamProposalEvent
  | AiStreamDoneEvent
  | AiStreamErrorEvent
  | AiStreamEndEvent
