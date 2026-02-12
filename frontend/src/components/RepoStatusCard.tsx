import React from 'react'
import { GitRepository, GitStatus } from '../types'

interface RepoStatusCardProps {
  repository: GitRepository
  status: GitStatus | null
  onPull: () => void
  onPush: () => void
  onDisconnect: () => void
  onAddProject: () => void
  loading: boolean
  disabled?: boolean
}

export function RepoStatusCard({
  repository,
  status,
  onPull,
  onPush,
  onDisconnect,
  onAddProject,
  loading,
  disabled = false,
}: RepoStatusCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const hasRemote = !!repository.remote_url

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Repository</h3>
          <p className="text-sm text-gray-400">Git operations and status</p>
        </div>
        <button className="btn btn-sm" onClick={onAddProject}>
          Add Project
        </button>
      </div>

      <div className="bg-black/20 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">Connected</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Remote URL</div>
            <div className="text-gray-200 font-mono truncate text-xs">
              {repository.remote_url || 'Local project (no remote)'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Default Branch</div>
            <div className="text-gray-200 text-xs">{repository.default_branch}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Project Root</div>
            <div className="text-gray-200 font-mono truncate text-xs">{repository.directory}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Last Synced</div>
            <div className="text-gray-200 text-xs">{formatDate(repository.last_synced_at)}</div>
          </div>
        </div>

        {status && (
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500">Ahead:</span>
                <span className="text-gray-200">{status.ahead}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500">Behind:</span>
                <span className="text-gray-200">{status.behind}</span>
              </span>
              {status.has_conflicts && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Conflicts detected</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {hasRemote && (
            <>
              <button
                onClick={onPull}
                disabled={disabled || loading}
                className="flex-1 btn btn-sm"
              >
                Pull
              </button>
              <button
                onClick={onPush}
                disabled={disabled || loading}
                className="flex-1 btn btn-sm"
              >
                Push
              </button>
            </>
          )}
          <button
            onClick={onDisconnect}
            disabled={disabled || loading}
            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}
