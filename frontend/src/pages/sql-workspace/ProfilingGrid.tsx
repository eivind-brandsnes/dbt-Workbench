import { SqlQueryProfile } from '../../types'

interface ProfilingGridProps {
  profiling: SqlQueryProfile | null
}

export const ProfilingGrid = ({ profiling }: ProfilingGridProps) => {
  if (!profiling) {
    return <div className="sqlwb-empty">Run a query with profiling to inspect column statistics.</div>
  }

  return (
    <div className="sqlwb-profiling-grid">
      <div className="sqlwb-results-meta">Based on {profiling.row_count} rows</div>
      <div className="sqlwb-table-wrap">
        <table className="sqlwb-compact-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Nulls</th>
              <th>Distinct</th>
              <th>Min</th>
              <th>Max</th>
              <th>Sample</th>
            </tr>
          </thead>
          <tbody>
            {profiling.columns.map((col) => (
              <tr key={col.column_name}>
                <td className="sqlwb-mono">{col.column_name}</td>
                <td>{col.null_count ?? 0}</td>
                <td>{col.distinct_count ?? '-'}</td>
                <td>{col.min_value !== undefined && col.min_value !== null ? String(col.min_value) : '-'}</td>
                <td>{col.max_value !== undefined && col.max_value !== null ? String(col.max_value) : '-'}</td>
                <td>
                  {col.sample_values && col.sample_values.length > 0
                    ? col.sample_values.map((value) => String(value)).join(', ')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
