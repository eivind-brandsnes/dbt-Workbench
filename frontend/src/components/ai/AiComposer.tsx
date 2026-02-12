import { useState } from 'react'

import { useAi } from '../../context/AiContext'
import { AiChatContext } from '../../types/ai'

export function AiComposer() {
  const { draftPrompt, setDraftPrompt, sendMessage, isStreaming } = useAi()
  const [includeSqlMetadata, setIncludeSqlMetadata] = useState(false)
  const [includeLineageGraph, setIncludeLineageGraph] = useState(false)
  const [includeRunLogs, setIncludeRunLogs] = useState(false)
  const [catalogQuery, setCatalogQuery] = useState('')

  const handleSend = async () => {
    const prompt = draftPrompt.trim()
    if (!prompt || isStreaming) return

    const context: AiChatContext = {
      sql_metadata: includeSqlMetadata,
      lineage_graph: includeLineageGraph,
      run_logs: includeRunLogs,
      catalog_query: catalogQuery.trim() || undefined,
    }

    setDraftPrompt('')
    await sendMessage(prompt, context)
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <textarea
        className="h-24 w-full resize-none rounded border border-border bg-panel px-3 py-2 text-sm text-text"
        placeholder="Ask about SQL, lineage, run failures, or request a suggested command."
        value={draftPrompt}
        onChange={(event) => setDraftPrompt(event.target.value)}
      />

      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeSqlMetadata}
            onChange={(e) => setIncludeSqlMetadata(e.target.checked)}
          />
          SQL metadata
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeLineageGraph}
            onChange={(e) => setIncludeLineageGraph(e.target.checked)}
          />
          Lineage graph
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeRunLogs}
            onChange={(e) => setIncludeRunLogs(e.target.checked)}
          />
          Run logs
        </label>
      </div>

      <input
        className="w-full rounded border border-border bg-panel px-3 py-2 text-xs text-text"
        placeholder="Optional: catalog search query"
        value={catalogQuery}
        onChange={(event) => setCatalogQuery(event.target.value)}
      />

      <button
        type="button"
        className="w-full rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        onClick={handleSend}
        disabled={isStreaming || !draftPrompt.trim()}
      >
        {isStreaming ? 'Generating…' : 'Send'}
      </button>
    </div>
  )
}
