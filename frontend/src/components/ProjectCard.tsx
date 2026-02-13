import React from 'react'
import { WorkspaceSummary } from '../types'

interface ProjectCardProps {
  project: WorkspaceSummary
  isActive: boolean
  onActivate: () => void
}

export function ProjectCard({ project, isActive, onActivate }: ProjectCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 transition-all duration-200 hover:border-border ${
        isActive
          ? 'bg-accent/10 border-accent/60 ring-1 ring-accent/30'
          : 'panel-gradient-subtle border-border hover:bg-panel/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-text font-semibold truncate">{project.name}</h3>
            {isActive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/20 text-accent">
                Active
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Key:</span>
              <code className="text-muted font-mono">{project.key}</code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Artifacts:</span>
              <code className="text-muted font-mono truncate">{project.artifacts_path}</code>
            </div>
          </div>
        </div>
        {!isActive && (
          <button
            onClick={onActivate}
            className="btn btn-sm shrink-0"
          >
            Activate
          </button>
        )}
      </div>
    </div>
  )
}
