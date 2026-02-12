import { SqlOutputEntry } from './types'

interface OutputPanelProps {
  entries: SqlOutputEntry[]
  onClear: () => void
}

const levelLabel = {
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
} as const

export const OutputPanel = ({ entries, onClear }: OutputPanelProps) => {
  return (
    <div className="sqlwb-output-panel">
      <div className="sqlwb-output-header">
        <span>Execution output</span>
        <button type="button" className="sqlwb-btn sqlwb-btn-ghost" onClick={onClear}>
          Clear
        </button>
      </div>

      {entries.length === 0 && <div className="sqlwb-empty">No logs yet.</div>}

      {entries.length > 0 && (
        <div className="sqlwb-output-list">
          {entries.map((entry) => (
            <div key={entry.id} className={`sqlwb-output-row level-${entry.level}`}>
              <span className="sqlwb-output-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
              <span className="sqlwb-output-level">{levelLabel[entry.level]}</span>
              <span className="sqlwb-output-message">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
