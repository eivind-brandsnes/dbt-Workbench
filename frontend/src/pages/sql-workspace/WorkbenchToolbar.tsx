import { WorkspaceMode } from './types'

interface EnvironmentOption {
  id: number
  name: string
}

interface WorkbenchToolbarProps {
  environmentId: number | ''
  environments: EnvironmentOption[]
  onEnvironmentChange: (value: number | '') => void
  activeMode: WorkspaceMode
  onModeChange: (mode: WorkspaceMode) => void
  editorTheme: 'dark' | 'light'
  onEditorThemeChange: (theme: 'dark' | 'light') => void
  onRun: () => void
  onCancel: () => void
  onSave: () => void
  onNewTab: () => void
  onFocusEditor: () => void
  onResetLayout: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  isRunning: boolean
  canSave: boolean
  canRun: boolean
  isDeveloperOrAdmin: boolean
  showNavigatorToggle: boolean
  navigatorOpen: boolean
  onToggleNavigator: () => void
}

export const WorkbenchToolbar = ({
  environmentId,
  environments,
  onEnvironmentChange,
  activeMode,
  onModeChange,
  editorTheme,
  onEditorThemeChange,
  onRun,
  onCancel,
  onSave,
  onNewTab,
  onFocusEditor,
  onResetLayout,
  isFullscreen,
  onToggleFullscreen,
  isRunning,
  canSave,
  canRun,
  isDeveloperOrAdmin,
  showNavigatorToggle,
  navigatorOpen,
  onToggleNavigator,
}: WorkbenchToolbarProps) => {
  return (
    <div className="sqlwb-toolbar" role="toolbar" aria-label="SQL workbench controls">
      <div className="sqlwb-toolbar-group" data-testid="editor-action-bar">
        {showNavigatorToggle && (
          <button
            type="button"
            className="sqlwb-btn sqlwb-btn-ghost"
            onClick={onToggleNavigator}
          >
            {navigatorOpen ? 'Hide navigator' : 'Show navigator'}
          </button>
        )}
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onNewTab}
          title="Ctrl/Cmd+Shift+T"
        >
          New SQL Tab
        </button>
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-primary"
          onClick={onRun}
          disabled={isRunning || !canRun}
          title="Ctrl/Cmd+Enter"
        >
          {isRunning ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onCancel}
          disabled={!isRunning}
        >
          Cancel
        </button>
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onSave}
          disabled={!canSave || !isDeveloperOrAdmin}
          title="Ctrl/Cmd+S"
        >
          Save
        </button>
      </div>

      <div className="sqlwb-toolbar-group">
        <label className="sqlwb-toolbar-label" htmlFor="sqlwb-environment-select">
          Environment
        </label>
        <select
          id="sqlwb-environment-select"
          className="sqlwb-select"
          value={environmentId}
          onChange={(event) => {
            const value = event.target.value
            onEnvironmentChange(value ? Number(value) : '')
          }}
        >
          {environments.length === 0 && <option value="">Default</option>}
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>

        <div className="sqlwb-toggle" role="group" aria-label="Editor mode">
          <button
            type="button"
            className={`sqlwb-toggle-btn ${activeMode === 'sql' ? 'is-active' : ''}`}
            onClick={() => onModeChange('sql')}
          >
            SQL
          </button>
          <button
            type="button"
            className={`sqlwb-toggle-btn ${activeMode === 'model' ? 'is-active' : ''}`}
            onClick={() => onModeChange('model')}
          >
            Model
          </button>
        </div>

        <div className="sqlwb-toggle" role="group" aria-label="Editor theme">
          <button
            type="button"
            className={`sqlwb-toggle-btn ${editorTheme === 'dark' ? 'is-active' : ''}`}
            onClick={() => onEditorThemeChange('dark')}
          >
            Dark
          </button>
          <button
            type="button"
            className={`sqlwb-toggle-btn ${editorTheme === 'light' ? 'is-active' : ''}`}
            onClick={() => onEditorThemeChange('light')}
          >
            Light
          </button>
        </div>

        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onFocusEditor}
        >
          Focus Editor
        </button>
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onResetLayout}
        >
          Reset Layout
        </button>
        <button
          type="button"
          className="sqlwb-btn sqlwb-btn-ghost"
          onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        </button>
      </div>
    </div>
  )
}
