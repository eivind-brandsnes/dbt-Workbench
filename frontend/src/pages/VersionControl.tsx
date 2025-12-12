import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'

import { GitService } from '../services/gitService'
import {
  AuditRecord,
  GitBranch,
  GitDiff,
  GitFileContent,
  GitFileNode,
  GitHistoryEntry,
  GitStatus,
} from '../types'

const CRITICAL_FILES = ['dbt_project.yml', 'profiles.yml', 'packages.yml', 'selectors.yml', 'manifest.json']

function FileTree({ nodes, onSelect }: { nodes: GitFileNode[]; onSelect: (path: string) => void }) {
  const sorted = useMemo(() => nodes.slice().sort((a, b) => a.path.localeCompare(b.path)), [nodes])
  return (
    <div className="space-y-1">
      {sorted.map((node) => (
        <button
          key={node.path}
          onClick={() => onSelect(node.path)}
          className="w-full text-left px-2 py-1 rounded hover:bg-gray-800 text-gray-200 border border-gray-800"
        >
          <span className="font-mono text-xs text-gray-400">{node.category ? `[${node.category}] ` : ''}</span>
          {node.path}
        </button>
      ))}
    </div>
  )
}

function ChangeList({ status }: { status: GitStatus | null }) {
  if (!status) return null
  if (!status.changes.length) return <div className="text-sm text-gray-400">Working tree clean.</div>
  return (
    <ul className="text-sm text-gray-200 space-y-1">
      {status.changes.map((change) => (
        <li key={`${change.path}-${change.change_type}`} className="flex items-center justify-between">
          <span className="font-mono text-xs">{change.path}</span>
          <span className="text-accent text-xs uppercase">{change.change_type}</span>
        </li>
      ))}
    </ul>
  )
}

export default function VersionControlPage() {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [files, setFiles] = useState<GitFileNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [fileContent, setFileContent] = useState<GitFileContent | null>(null)
  const [editorText, setEditorText] = useState<string>('')
  const [commitMessage, setCommitMessage] = useState('')
  const [diffs, setDiffs] = useState<GitDiff[]>([])
  const [history, setHistory] = useState<GitHistoryEntry[]>([])
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const reload = async () => {
    const [newStatus, branchList, fileList, historyEntries, audits] = await Promise.all([
      GitService.status(),
      GitService.branches(),
      GitService.files(),
      GitService.history(),
      GitService.audit(),
    ])
    setStatus(newStatus)
    setBranches(branchList)
    setFiles(fileList)
    setHistory(historyEntries)
    setAuditRecords(audits)
  }

  useEffect(() => {
    reload().catch((err) => console.error(err))
  }, [])

  const loadFile = async (path: string) => {
    const content = await GitService.readFile(path)
    setSelectedPath(path)
    setFileContent(content)
    setEditorText(content.content)
    const diff = await GitService.diff(path)
    setDiffs(diff)
  }

  const saveFile = async () => {
    if (!selectedPath) return
    setIsSaving(true)
    setValidationErrors([])
    try {
      const payload = { path: selectedPath, content: editorText, message: CRITICAL_FILES.includes(selectedPath.split('/').pop() || '') ? commitMessage : undefined }
      const result = await GitService.writeFile(payload)
      if (!result.is_valid) {
        setValidationErrors(result.errors || [])
        return
      }
      await reload()
      await loadFile(selectedPath)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    await GitService.commit(commitMessage)
    setCommitMessage('')
    await reload()
  }

  const handleBranchChange = async (branch: string) => {
    await GitService.switchBranch(branch)
    await reload()
  }

  const validationPanel = validationErrors.length ? (
    <div className="bg-red-900/40 border border-red-600 text-red-100 rounded p-3 text-sm">
      <div className="font-semibold mb-2">Validation errors</div>
      <ul className="list-disc list-inside space-y-1">
        {validationErrors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    </div>
  ) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="bg-panel border border-gray-800 rounded p-4 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-lg font-semibold text-white">Git status</div>
              <div className="text-sm text-gray-400">Branch: {status?.branch || 'unknown'}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => GitService.pull().then(reload)}>
                Pull
              </button>
              <button className="btn" onClick={() => GitService.push().then(reload)}>
                Push
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>Ahead: {status?.ahead ?? 0}</span>
            <span>Behind: {status?.behind ?? 0}</span>
            {status?.has_conflicts && <span className="text-red-400">Conflicts detected</span>}
          </div>
          <div className="mt-3">
            <ChangeList status={status} />
          </div>
        </div>
        <div className="bg-panel border border-gray-800 rounded p-4 w-72">
          <div className="text-lg text-white font-semibold mb-2">Branch</div>
          <select
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm"
            value={branches.find((b) => b.is_active)?.name || ''}
            onChange={(e) => handleBranchChange(e.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name} {branch.is_active ? '(current)' : ''}
              </option>
            ))}
          </select>
          <div className="mt-3 text-xs text-gray-400">
            Recent commits
            <ul className="space-y-1 mt-1">
              {history.slice(0, 5).map((entry) => (
                <li key={entry.commit_hash} className="truncate">
                  <span className="font-semibold text-gray-200">{entry.message}</span>
                  <div className="text-gray-400 text-[11px]">{entry.commit_hash.substring(0, 7)} – {entry.author}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-panel border border-gray-800 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-white font-semibold">Project files</div>
              <div className="text-sm text-gray-400">Browse dbt models and configuration</div>
            </div>
          </div>
          <FileTree nodes={files} onSelect={loadFile} />
        </div>
        <div className="bg-panel border border-gray-800 rounded p-4 col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Editor</div>
              <div className="text-sm text-gray-400">{selectedPath || 'Select a file to begin'}</div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                placeholder="Commit or file note"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <button className="btn" onClick={saveFile} disabled={isSaving || !selectedPath}>
                {fileContent?.readonly ? 'Read-only' : 'Save'}
              </button>
              <button className="btn" onClick={handleCommit} disabled={!commitMessage.trim()}>
                Commit
              </button>
            </div>
          </div>
          {fileContent?.readonly && (
            <div className="text-xs text-yellow-300">This file is read-only. Enable edits explicitly in Git settings.</div>
          )}
          {validationPanel}
          <CodeMirror
            value={editorText}
            height="340px"
            theme={vscodeDark}
            onChange={(val) => setEditorText(val)}
            extensions={[sql()]}
            editable={!fileContent?.readonly}
          />
          <div className="bg-gray-900 border border-gray-800 rounded p-3 text-sm text-gray-200">
            <div className="font-semibold mb-2">Diff preview</div>
            {diffs.map((diff) => (
              <pre key={diff.path} className="text-xs whitespace-pre-wrap bg-black/40 p-2 rounded border border-gray-800 overflow-auto">
                {diff.diff || 'No changes'}
              </pre>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-panel border border-gray-800 rounded p-4">
          <div className="text-white font-semibold mb-2">Audit log</div>
          <div className="space-y-2 max-h-64 overflow-auto text-sm text-gray-200">
            {auditRecords.map((record) => (
              <div key={record.id} className="border border-gray-800 rounded p-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{record.action}</span>
                  <span>{new Date(record.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-white">{record.resource}</div>
                {record.commit_hash && <div className="text-xs text-accent">Commit {record.commit_hash.substring(0, 7)}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-panel border border-gray-800 rounded p-4">
          <div className="text-white font-semibold mb-2">Guidance</div>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>Editing core configuration files will prompt for confirmation.</li>
            <li>Use the Save button to persist changes without running dbt.</li>
            <li>Review diffs before committing to keep branches clean.</li>
            <li>Switch branches carefully when uncommitted changes exist.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
