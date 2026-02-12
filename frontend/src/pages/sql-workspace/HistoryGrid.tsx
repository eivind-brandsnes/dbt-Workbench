import { StatusBadge } from '../../components/StatusBadge'
import { SqlQueryHistoryEntry } from '../../types'

interface HistoryGridProps {
  history: SqlQueryHistoryEntry[]
  historyPage: number
  historyTotal: number
  historyStatusFilter: string
  setHistoryStatusFilter: (value: string) => void
  historyModelFilter: string
  setHistoryModelFilter: (value: string) => void
  historyDateFrom: string
  setHistoryDateFrom: (value: string) => void
  historyDateTo: string
  setHistoryDateTo: (value: string) => void
  modelOptions: Array<{ id: string; name: string }>
  onReRun: (entry: SqlQueryHistoryEntry) => void
  onDelete: (id: number) => void
  onPageChange: (page: number) => void
}

const HISTORY_PAGE_SIZE = 20

export const HistoryGrid = ({
  history,
  historyPage,
  historyTotal,
  historyStatusFilter,
  setHistoryStatusFilter,
  historyModelFilter,
  setHistoryModelFilter,
  historyDateFrom,
  setHistoryDateFrom,
  historyDateTo,
  setHistoryDateTo,
  modelOptions,
  onReRun,
  onDelete,
  onPageChange,
}: HistoryGridProps) => {
  return (
    <div className="sqlwb-history-grid">
      <div className="sqlwb-history-filters">
        <label>
          <span>Status</span>
          <select
            value={historyStatusFilter}
            onChange={(event) => {
              setHistoryStatusFilter(event.target.value)
              onPageChange(1)
            }}
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="cancelled">Cancelled</option>
            <option value="timeout">Timeout</option>
          </select>
        </label>
        <label>
          <span>Model</span>
          <select
            value={historyModelFilter}
            onChange={(event) => {
              setHistoryModelFilter(event.target.value)
              onPageChange(1)
            }}
          >
            <option value="all">All</option>
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            type="date"
            value={historyDateFrom}
            onChange={(event) => {
              setHistoryDateFrom(event.target.value)
              onPageChange(1)
            }}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={historyDateTo}
            onChange={(event) => {
              setHistoryDateTo(event.target.value)
              onPageChange(1)
            }}
          />
        </label>
      </div>

      <div className="sqlwb-table-wrap">
        <table className="sqlwb-compact-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Env</th>
              <th>Query</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString()}</td>
                <td>
                  <StatusBadge status={entry.status} />
                </td>
                <td>{entry.model_ref ? 'dbt model' : 'custom SQL'}</td>
                <td>{entry.environment_name || '-'}</td>
                <td>
                  <div className="sqlwb-history-query">
                    <code>{entry.query_text.replace(/\s+/g, ' ').slice(0, 100)}{entry.query_text.length > 100 ? '…' : ''}</code>
                    {entry.model_ref && <span className="sqlwb-model-chip">{entry.model_ref}</span>}
                  </div>
                </td>
                <td>
                  <div className="sqlwb-inline-actions">
                    <button type="button" className="sqlwb-link" onClick={() => onReRun(entry)}>
                      Re-run
                    </button>
                    <button type="button" className="sqlwb-link sqlwb-link-danger" onClick={() => onDelete(entry.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="sqlwb-empty-cell">
                  No queries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {historyTotal > HISTORY_PAGE_SIZE && (
        <div className="sqlwb-pagination">
          <span>
            Page {historyPage} of {Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))}
          </span>
          <div className="sqlwb-pagination-actions">
            <button
              type="button"
              className="sqlwb-btn sqlwb-btn-ghost"
              disabled={historyPage === 1}
              onClick={() => onPageChange(Math.max(1, historyPage - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="sqlwb-btn sqlwb-btn-ghost"
              disabled={historyPage >= Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
              onClick={() => onPageChange(historyPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
