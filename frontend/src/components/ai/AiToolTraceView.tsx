import { AiMessage } from '../../types/ai'

export function AiToolTraceView({ message }: { message: AiMessage }) {
  const keys = Object.keys(message.message_metadata || {})
  if (keys.length === 0) return null

  return (
    <details className="mt-1 rounded border border-border bg-panel px-2 py-1 text-[11px] text-muted">
      <summary className="cursor-pointer">Trace metadata</summary>
      <pre className="mt-1 overflow-auto text-[10px] text-text">
        {JSON.stringify(message.message_metadata, null, 2)}
      </pre>
    </details>
  )
}
