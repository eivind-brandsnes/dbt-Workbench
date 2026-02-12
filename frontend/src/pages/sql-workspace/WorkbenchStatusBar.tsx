import { SqlEditorTab, SqlResultTab } from './types'

interface WorkbenchStatusBarProps {
  isRunning: boolean
  environmentName: string
  activeTab: SqlEditorTab | null
  activeResultTab: SqlResultTab | null
}

export const WorkbenchStatusBar = ({
  isRunning,
  environmentName,
  activeTab,
  activeResultTab,
}: WorkbenchStatusBarProps) => {
  const result = activeResultTab?.result || null

  return (
    <div className="sqlwb-statusbar" role="status" aria-live="polite">
      <span className={`sqlwb-status-pill ${isRunning ? 'is-running' : 'is-idle'}`}>
        {isRunning ? 'Running' : 'Idle'}
      </span>
      <span>Environment: {environmentName}</span>
      <span>Mode: {activeTab?.mode === 'model' ? 'dbt model' : 'custom SQL'}</span>
      <span>Tab: {activeTab?.title || 'None'}</span>
      {result && (
        <>
          <span>Rows: {result.row_count}</span>
          <span>Execution: {result.execution_time_ms} ms</span>
        </>
      )}
    </div>
  )
}
