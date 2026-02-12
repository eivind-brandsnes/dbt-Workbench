import React, { useState } from 'react'
import { AuditRecord } from '../types'

interface AuditLogListProps {
  records: AuditRecord[]
  maxEntries?: number
}

type FilterType = 'all' | 'commit' | 'file' | 'workspace'

export function AuditLogList({ records, maxEntries }: AuditLogListProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredRecords = records
    .filter((record) => {
      if (filter === 'all') return true
      return record.action.toLowerCase().includes(filter)
    })
    .slice(0, maxEntries)

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

  const getActionIcon = (action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('commit') || lower.includes('push')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    }
    if (lower.includes('file') || lower.includes('edit') || lower.includes('create')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
    if (lower.includes('workspace') || lower.includes('switch') || lower.includes('activate')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-6">
        <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <div className="text-gray-500 text-sm">No activity recorded yet</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Activity Log</h3>
        <div className="flex gap-2">
          {(['all', 'commit', 'file', 'workspace'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filter === type
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-auto">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="bg-black/20 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5 text-accent">
                  {getActionIcon(record.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {record.action}
                  </div>
                  <div className="text-gray-400 text-xs truncate">{record.resource}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 shrink-0">
                {formatDate(record.created_at)}
              </div>
            </div>
            {record.commit_hash && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Commit:</span>
                <code className="text-xs text-accent font-mono">
                  {record.commit_hash.substring(0, 7)}
                </code>
              </div>
            )}
          </div>
        ))}
        {filteredRecords.length === 0 && (
          <div className="text-center py-6">
            <div className="text-gray-500 text-sm">No matching activity</div>
          </div>
        )}
      </div>
    </div>
  )
}
