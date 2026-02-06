import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ArtifactSummary, GitRepository } from '../types'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ThemeColorKey, ThemeMode } from '../utils/theme'

interface ConfigResponse {
  execution: {
    dbt_project_path: string
  }
  artifacts_path: string
  auth: {
    enabled: boolean
  }
  artifact_watcher: {
    max_versions: number
    monitored_files: string[]
    polling_interval: number
  }
}

function SettingsPage() {
  const { user } = useAuth()
  const { mode, resolved, setColor, resetTheme } = useTheme()
  const [artifacts, setArtifacts] = useState<ArtifactSummary | null>(null)
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [repo, setRepo] = useState<GitRepository | null>(null)
  const [editingMode, setEditingMode] = useState<ThemeMode>(mode)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    api.get<ArtifactSummary>('/artifacts').then((res) => setArtifacts(res.data)).catch(() => setArtifacts(null))
    api.get<ConfigResponse>('/config').then((res) => setConfig(res.data)).catch(() => setConfig(null))
    api.get<GitRepository>('/git/repository').then((res) => setRepo(res.data)).catch(() => setRepo(null))
  }, [])

  useEffect(() => {
    setEditingMode(mode)
  }, [mode])

  const activeTheme = resolved[editingMode]
  const previewStyle = activeTheme.variables as React.CSSProperties
  const colorFields: Array<{ key: ThemeColorKey; label: string; description: string }> = [
    { key: 'primary', label: 'Primary', description: 'Buttons, highlights, key actions.' },
    { key: 'secondary', label: 'Secondary', description: 'Accent elements and secondary actions.' },
    { key: 'background', label: 'Background', description: 'Page background.' },
    { key: 'surface', label: 'Surface', description: 'Cards, panels, tables.' },
    { key: 'text', label: 'Text', description: 'Default text color.' },
  ]

  const handleDraftChange = (modeKey: ThemeMode, key: ThemeColorKey, value: string) => {
    const draftKey = `${modeKey}-${key}`
    setDrafts((prev) => ({ ...prev, [draftKey]: value }))
    if (/^#?[0-9a-fA-F]{6}$/.test(value.trim())) {
      const normalized = value.startsWith('#') ? value : `#${value}`
      setColor(modeKey, key, normalized)
    }
  }

  const handleDraftBlur = (modeKey: ThemeMode, key: ThemeColorKey) => {
    const draftKey = `${modeKey}-${key}`
    setDrafts((prev) => ({ ...prev, [draftKey]: activeTheme.colors[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Selector */}
        <div className="md:col-span-2 bg-panel border border-border shadow rounded-lg p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-medium text-text">Color Theme</h3>
              <p className="text-sm text-muted">Edit each color and the UI updates instantly with WCAG contrast checks.</p>
            </div>
            <button
              onClick={() => resetTheme()}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface/80"
            >
              Reset to default theme
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditingMode('light')}
              className={`px-3 py-1.5 rounded-md text-sm border ${editingMode === 'light'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface text-text border-border'
                }`}
            >
              Light
            </button>
            <button
              onClick={() => setEditingMode('dark')}
              className={`px-3 py-1.5 rounded-md text-sm border ${editingMode === 'dark'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface text-text border-border'
                }`}
            >
              Dark
            </button>
            <span className="text-xs text-muted">Currently applied: {mode} mode</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6">
            <div className="space-y-4">
              {colorFields.map((field) => {
                const draftKey = `${editingMode}-${field.key}`
                const value = drafts[draftKey] ?? activeTheme.colors[field.key]
                return (
                  <div key={field.key} className="rounded-md border border-border bg-surface p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-text">{field.label}</div>
                        <div className="text-xs text-muted">{field.description}</div>
                      </div>
                      <input
                        type="color"
                        value={activeTheme.colors[field.key]}
                        onChange={(event) => {
                          const next = event.target.value
                          const draftKey = `${editingMode}-${field.key}`
                          setDrafts((prev) => ({ ...prev, [draftKey]: next }))
                          setColor(editingMode, field.key, next)
                        }}
                        className="h-10 w-14 rounded border border-border bg-surface"
                        aria-label={`${field.label} color`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => handleDraftChange(editingMode, field.key, event.target.value)}
                        onBlur={() => handleDraftBlur(editingMode, field.key)}
                        className="h-9 w-28 rounded border border-border bg-bg px-3 text-sm text-text font-mono"
                      />
                      <span className="text-xs text-muted uppercase">Hex</span>
                    </div>
                  </div>
                )
              })}

              {activeTheme.validation.adjustments.length > 0 && (
                <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text">
                  <div className="font-medium">Contrast adjustments applied</div>
                  <div className="text-xs text-muted mt-1">
                    {activeTheme.validation.adjustments.map((adjustment) => (
                      <div key={`${adjustment.key}-${adjustment.to}`}>
                        {adjustment.reason} ({adjustment.from} → {adjustment.to})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!activeTheme.validation.isValid && (
                <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text">
                  <div className="font-medium">Theme cannot be saved yet</div>
                  <div className="text-xs text-muted mt-1">
                    {activeTheme.validation.violations.map((violation) => (
                      <div key={`${violation.id}-${violation.label}`}>
                        {violation.label} needs {violation.minRatio}:1 (current {violation.ratio.toFixed(2)}:1)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-bg p-4 space-y-4" style={previewStyle}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide">Preview</div>
                  <div className="text-sm font-semibold text-text">Theme snapshot</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                  Primary
                </span>
              </div>
              <div className="rounded-md border border-border bg-panel p-4 space-y-2">
                <div className="text-sm font-medium text-text">Panel heading</div>
                <div className="text-xs text-muted">This is how surface + text colors combine.</div>
                <button className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm">
                  Primary action
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-secondary" />
                Secondary accent preview
              </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                <div className="text-sm font-semibold text-text">Contrast status</div>
                <div className="space-y-2 text-xs text-muted">
                  {activeTheme.validation.checks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between">
                      <span>{check.label}</span>
                      <span className={check.pass ? 'text-primary' : 'text-secondary'}>
                        {check.ratio.toFixed(2)}:1 {check.pass ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-muted">
                  Minimum 4.5:1 for text, 3:1 for UI accents.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Configuration */}
        <div className="bg-surface border border-border shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-text border-b border-border pb-2">Project Configuration</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted">Project Path</dt>
              <dd className="mt-1 text-sm text-text font-mono bg-panel p-1 rounded">
                {repo?.directory || config?.execution.dbt_project_path || 'Loading...'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted">Artifacts Path</dt>
              <dd className="mt-1 text-sm text-text font-mono bg-panel p-1 rounded">
                {/* Artifacts are stored in runs/ but displayed path often refers to where we look for them initially */}
                {config?.artifacts_path || 'Loading...'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted">API URL</dt>
              <dd className="mt-1 text-sm text-text font-mono bg-panel p-1 rounded">
                {(import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Artifact Status */}
        <div className="bg-surface border border-border shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-text border-b border-border pb-2">Artifact Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Manifest</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${artifacts?.manifest ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {artifacts?.manifest ? 'Present' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Run Results</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${artifacts?.run_results ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {artifacts?.run_results ? 'Present' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Catalog</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${artifacts?.catalog ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {artifacts?.catalog ? 'Present' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Docs</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${artifacts?.docs ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {artifacts?.docs ? 'Available' : 'Missing'}
              </span>
            </div>
            <p className="text-xs text-muted mt-2">
              Artifacts are monitored automatically.
              Watcher checks every {config?.artifact_watcher.polling_interval || '?'}s.
            </p>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-surface border border-border shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-text border-b border-border pb-2">User Information</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4">
            <div>
              <dt className="text-sm font-medium text-muted">Current User</dt>
              <dd className="mt-1 text-sm text-text">{user?.username || 'Guest'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted">Role</dt>
              <dd className="mt-1 text-sm text-text">{user?.role || 'Viewer'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted">Auth Status</dt>
              <dd className="mt-1 text-sm text-text">
                {config?.auth.enabled ? 'Enabled' : 'Disabled (Single User)'}
              </dd>
            </div>
          </dl>
        </div>

        {/* About */}
        <div className="bg-surface border border-border shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-text border-b border-border pb-2">About</h3>
          <p className="text-sm text-muted">
            dbt-Workbench is a developer tool for inspecting and managing dbt projects.
          </p>
          <div className="text-xs text-muted">
            <p>Monitored Files: {config?.artifact_watcher.monitored_files.join(', ') || 'manifest.json, ...'}</p>
            <p>Max Versions Kept: {config?.artifact_watcher.max_versions || 10}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
