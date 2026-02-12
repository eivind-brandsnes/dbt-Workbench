import { useEffect, useState } from 'react'

import { useAi } from '../../context/AiContext'
import { AiService } from '../../services/aiService'
import { AiMcpServer, AiProviderOverride } from '../../types/ai'

export function AiProviderSwitcher() {
  const { settings, sessionProviderOverride, setSessionProviderOverride } = useAi()
  const [mcpServers, setMcpServers] = useState<AiMcpServer[]>([])

  useEffect(() => {
    AiService.listMcpServers()
      .then((rows) => setMcpServers(rows.filter((row) => row.enabled)))
      .catch(() => setMcpServers([]))
  }, [])

  if (!settings.allow_session_provider_override) {
    return (
      <div className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
        Workspace default provider is enforced by admin.
      </div>
    )
  }

  const mode = sessionProviderOverride?.mode || settings.default_mode
  const provider = sessionProviderOverride?.direct_provider || settings.default_direct_provider

  const updateOverride = (next: AiProviderOverride | null) => {
    setSessionProviderOverride(next)
  }

  const handleModeChange = (nextMode: 'direct' | 'mcp') => {
    if (nextMode === settings.default_mode && !sessionProviderOverride) return

    if (nextMode === 'direct') {
      updateOverride({
        mode: 'direct',
        direct_provider: provider,
      })
      return
    }

    updateOverride({
      mode: 'mcp',
      mcp_server_id: sessionProviderOverride?.mcp_server_id || mcpServers[0]?.id,
    })
  }

  return (
    <div className="space-y-2 rounded border border-border bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">Provider</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`rounded px-2 py-1 text-xs ${mode === 'direct' ? 'bg-primary text-primary-foreground' : 'bg-panel text-text'}`}
          onClick={() => handleModeChange('direct')}
          type="button"
        >
          Direct API
        </button>
        <button
          className={`rounded px-2 py-1 text-xs ${mode === 'mcp' ? 'bg-primary text-primary-foreground' : 'bg-panel text-text'}`}
          onClick={() => handleModeChange('mcp')}
          type="button"
        >
          MCP
        </button>
      </div>

      {mode === 'direct' && (
        <select
          className="w-full rounded border border-border bg-panel px-2 py-1 text-xs text-text"
          value={provider}
          onChange={(event) =>
            updateOverride({
              mode: 'direct',
              direct_provider: event.target.value as 'openai' | 'anthropic' | 'gemini',
            })
          }
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Gemini</option>
        </select>
      )}

      {mode === 'mcp' && (
        <select
          className="w-full rounded border border-border bg-panel px-2 py-1 text-xs text-text"
          value={sessionProviderOverride?.mcp_server_id || mcpServers[0]?.id || ''}
          onChange={(event) =>
            updateOverride({
              mode: 'mcp',
              mcp_server_id: Number(event.target.value),
            })
          }
        >
          {mcpServers.length === 0 && <option value="">No MCP servers configured</option>}
          {mcpServers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name} ({server.mode})
            </option>
          ))}
        </select>
      )}

      {sessionProviderOverride && (
        <button
          type="button"
          className="w-full rounded border border-border px-2 py-1 text-xs text-muted hover:text-text"
          onClick={() => updateOverride(null)}
        >
          Clear session override
        </button>
      )}
    </div>
  )
}
