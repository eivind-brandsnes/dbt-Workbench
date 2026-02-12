import React from 'react'
import { GitHistoryEntry } from '../types'

interface CommitTimelineProps {
  history: GitHistoryEntry[]
  maxEntries?: number
}

export function CommitTimeline({ history, maxEntries = 5 }: CommitTimelineProps) {
  const entries = history.slice(0, maxEntries)

  if (entries.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-gray-500 text-sm">No commits yet</div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-800" />
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div key={entry.commit_hash} className="relative flex items-start gap-3">
            <div className="w-4 h-4 rounded-full bg-accent/20 border-2 border-accent/60 shrink-0 relative z-10 mt-0.5" />
            <div className="flex-1 min-w-0 bg-black/20 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-white font-medium text-sm truncate">{entry.message}</div>
                <div className="text-xs text-gray-500 shrink-0">{formatDate(entry.timestamp)}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <code className="text-accent">{entry.commit_hash.substring(0, 7)}</code>
                <span>•</span>
                <span>{entry.author}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
