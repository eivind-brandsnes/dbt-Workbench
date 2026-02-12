import React from 'react'
import { GitBranch, GitHistoryEntry } from '../types'

interface BranchSelectorProps {
  branches: GitBranch[]
  history: GitHistoryEntry[]
  currentBranch: string
  onBranchChange: (branch: string) => void
  disabled?: boolean
}

export function BranchSelector({
  branches,
  history,
  currentBranch,
  onBranchChange,
  disabled = false,
}: BranchSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold">Branch</h3>
        <p className="text-sm text-gray-400">Switch and manage branches</p>
      </div>

      <div className="bg-black/20 border border-gray-800 rounded-lg p-4 space-y-3">
        <select
          value={currentBranch}
          onChange={(e) => onBranchChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name} {branch.is_active ? '(current)' : ''}
            </option>
          ))}
        </select>

        {history.length > 0 && (
          <div className="border-t border-gray-800 pt-3">
            <div className="text-xs text-gray-500 mb-2">Recent commits</div>
            <div className="space-y-2">
              {history.slice(0, 5).map((entry) => (
                <div
                  key={entry.commit_hash}
                  className="flex items-start gap-2 text-xs group"
                >
                  <div className="mt-1 w-2 h-2 rounded-full bg-accent/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-200 font-medium truncate group-hover:text-white transition-colors">
                      {entry.message}
                    </div>
                    <div className="text-gray-500">
                      {entry.commit_hash.substring(0, 7)} • {entry.author}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
