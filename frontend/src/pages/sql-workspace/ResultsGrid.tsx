import { Table } from '../../components/Table'
import { SqlResultTab } from './types'

interface ResultsGridProps {
  activeResultTab: SqlResultTab | null
  currentRows: Record<string, any>[]
  totalResultPages: number
  resultsPage: number
  onResultsPageChange: (page: number) => void
}

export const ResultsGrid = ({
  activeResultTab,
  currentRows,
  totalResultPages,
  resultsPage,
  onResultsPageChange,
}: ResultsGridProps) => {
  const result = activeResultTab?.result || null
  const columns = result?.columns || []

  if (!result) {
    return <div className="sqlwb-empty">Run a query to see result rows.</div>
  }

  if (columns.length === 0) {
    return <div className="sqlwb-empty">Query returned no columns.</div>
  }

  return (
    <div className="sqlwb-results-grid">
      <div className="sqlwb-results-meta">
        <span>Rows: {result.row_count}</span>
        {result.truncated && <span className="sqlwb-warning-text">Results truncated</span>}
        <span>Execution: {result.execution_time_ms} ms</span>
        <span>Query ID: {result.query_id}</span>
      </div>

      <Table
        columns={columns.map((col) => ({
          key: col.name,
          header: col.name,
          render: (row: Record<string, any>) => {
            const value = row[col.name]
            if (value === null || value === undefined) return <span className="sqlwb-null">NULL</span>
            if (typeof value === 'object') return JSON.stringify(value)
            return String(value)
          },
        }))}
        data={currentRows}
      />

      {totalResultPages > 1 && (
        <div className="sqlwb-pagination">
          <span>
            Page {resultsPage} of {totalResultPages}
          </span>
          <div className="sqlwb-pagination-actions">
            <button
              type="button"
              className="sqlwb-btn sqlwb-btn-ghost"
              disabled={resultsPage === 1}
              onClick={() => onResultsPageChange(Math.max(1, resultsPage - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="sqlwb-btn sqlwb-btn-ghost"
              disabled={resultsPage === totalResultPages}
              onClick={() => onResultsPageChange(Math.min(totalResultPages, resultsPage + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
