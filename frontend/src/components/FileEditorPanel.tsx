import React, { FormEvent } from 'react'
import { GitFileContent, GitDiff } from '../types'

interface FileEditorPanelProps {
  selectedPath: string
  fileContent: GitFileContent | null
  fileEditContent: string
  onFileEditContentChange: (value: string) => void
  diffs: GitDiff[]
  commitMessage: string
  onCommitMessageChange: (value: string) => void
  onSave: () => void
  onCommit: () => void
  loading?: boolean
  disabled?: boolean
}

export function FileEditorPanel({
  selectedPath,
  fileContent,
  fileEditContent,
  onFileEditContentChange,
  diffs,
  commitMessage,
  onCommitMessageChange,
  onSave,
  onCommit,
  loading = false,
  disabled = false,
}: FileEditorPanelProps) {
  const handleFileSave = async (event: FormEvent) => {
    event.preventDefault()
    onSave()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text font-semibold">File Editor</h3>
          <p className="text-sm text-muted">
            {selectedPath || 'Select a file to edit'}
          </p>
        </div>
      </div>

      {fileContent ? (
        <div className="space-y-4">
          <div className="panel-gradient-subtle border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border panel-gradient-subtle">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <code className="text-xs text-muted truncate">{selectedPath}</code>
              </div>
              {fileContent.readonly && (
                <span className="text-xs text-muted">Read-only</span>
              )}
            </div>
            <textarea
              className="min-h-[240px] w-full resize-y bg-transparent px-4 py-3 text-xs font-mono text-text focus:outline-none"
              value={fileEditContent}
              onChange={(e) => onFileEditContentChange(e.target.value)}
              readOnly={fileContent.readonly}
              disabled={disabled}
              placeholder="File contents"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={disabled || loading || fileContent.readonly}
              className="btn btn-sm"
            >
              Save File
            </button>
            {fileContent.readonly && (
              <span className="text-xs text-muted">This file cannot be edited</span>
            )}
          </div>
        </div>
      ) : (
        <div className="panel-gradient-subtle border border-border rounded-lg p-8 text-center">
          <svg className="mb-3 mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <div className="text-muted text-sm">Select a file from the tree to view and edit</div>
        </div>
      )}

      {diffs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-text font-semibold text-sm">Diff Preview</h4>
          </div>
          <div className="panel-gradient-subtle border border-border rounded-lg overflow-hidden">
            {diffs.map((diff) => (
              <div key={diff.path} className="border-b border-border last:border-b-0">
                <div className="px-4 py-2 border-b border-border panel-gradient-subtle">
                  <code className="text-xs text-muted">{diff.path}</code>
                </div>
                <pre className="px-4 py-3 text-xs font-mono text-text whitespace-pre-wrap overflow-x-auto">
                  {diff.diff || 'No changes'}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {fileContent && (
        <div className="panel-gradient-subtle border border-border rounded-lg p-4">
          <form className="flex items-center gap-3" onSubmit={handleFileSave}>
            <input
              type="text"
              className="panel-input flex-1 rounded px-3 py-2 text-sm"
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => onCommitMessageChange(e.target.value)}
            />
            <button
              type="submit"
              onClick={onCommit}
              disabled={!commitMessage.trim() || disabled || loading}
              className="btn btn-sm"
            >
              Commit
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
