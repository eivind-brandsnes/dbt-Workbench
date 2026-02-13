import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAi } from '../context/AiContext'

interface TopBarProps {
  projectName?: string
  environment?: string
}

export function TopBar({ projectName, environment }: TopBarProps) {
  const { activeWorkspace, user, logout, isAuthEnabled, switchWorkspace, workspaces } = useAuth()
  const { openPanel, settings } = useAi()
  
  const [selection, setSelection] = useState<string>('')

  useEffect(() => {
    setSelection(String(activeWorkspace?.id ?? ''))
  }, [activeWorkspace])

  const displayProject = projectName || activeWorkspace?.name || 'Default dbt Project'
  const displayEnv = environment || (user ? `${user.role} · ${user.username}` : 'Local')

  return (
    <header className="panel-gradient-subtle panel-divider sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4">
      <div>
        
        <div className="flex items-center justify-between space-x-3 w-full">
          <div className="text-sm uppercase text-muted">Workspace</div>
          <div className="text-lg font-semibold text-text">{displayProject}</div>
          {workspaces.length > 1 && (
            <select
              className="panel-input rounded px-2 py-1 text-xs"
              value={selection}
              onChange={async e => {
                const id = Number(e.target.value)
                if (!Number.isNaN(id)) {
                  try {
                    await switchWorkspace(id)
                  } catch (err) {
                    console.error('Failed to switch workspace', err)
                  }
                }
              }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {settings.ai_system_enabled && settings.enabled && (
          <button
            type="button"
            onClick={() => openPanel()}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:bg-panel/80 hover:text-text"
            title="Open AI Copilot"
          >
            AI Copilot
          </button>
        )}
        <div className="panel-gradient-subtle rounded-full px-3 py-1 text-sm text-muted">
          {displayEnv}
        </div>
        {isAuthEnabled && user && (
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted hover:bg-panel/80 hover:text-text"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
