import { SqlQueryHistoryEntry, SqlQueryResult } from '../../types'

export type WorkspaceMode = 'sql' | 'model'

export type SqlBottomPanelTab = 'results' | 'profiling' | 'history' | 'output'

export type SqlEditorTheme = 'dark' | 'light'

export interface SqlEditorTab {
  id: string
  title: string
  mode: WorkspaceMode
  sqlText: string
  sourceFilePath?: string | null
  selectedModelId?: string | null
  compiledSql?: string
  compiledChecksum?: string
  compiledTarget?: string
  compiledForEnvironmentId?: number | null
  compileError?: string | null
  isLoadingCompiled?: boolean
  isDirty: boolean
  isReadonly?: boolean
  lastUsedAt: number
}

export interface SqlWorkbenchLayoutState {
  leftPaneWidth: number
  bottomPaneHeight: number
  isEditorFocused: boolean
}

export interface SqlWorkbenchPersistedStateV2 {
  version: 2
  tabs: Array<
    Pick<
      SqlEditorTab,
      | 'id'
      | 'title'
      | 'mode'
      | 'sqlText'
      | 'sourceFilePath'
      | 'selectedModelId'
      | 'isDirty'
      | 'isReadonly'
      | 'lastUsedAt'
    >
  >
  activeTabId: string | null
  environmentId: number | null
  editorTheme: SqlEditorTheme
  activeBottomPanel: SqlBottomPanelTab
  layout: SqlWorkbenchLayoutState
}

export interface LegacySqlWorkspaceState {
  sqlText?: string
  environmentId?: number | null
  mode?: 'sql' | 'model' | 'preview'
  editorTheme?: SqlEditorTheme
  selectedModelId?: string | null
}

export interface SqlResultTab {
  id: string
  title: string
  queryId: string
  createdAt: string
  sourceTabId: string
  result: SqlQueryResult
}

export interface SqlOutputEntry {
  id: string
  timestamp: string
  level: 'info' | 'error' | 'warning'
  message: string
}

export type SqlWorkbenchAction =
  | { type: 'tab/new'; payload?: { mode?: WorkspaceMode; sqlText?: string; title?: string } }
  | { type: 'tab/close'; payload: { tabId: string } }
  | { type: 'tab/activate'; payload: { tabId: string } }
  | { type: 'tab/updateSql'; payload: { tabId: string; sqlText: string } }
  | { type: 'panel/set'; payload: { panel: SqlBottomPanelTab } }
  | { type: 'result/add'; payload: { tab: SqlResultTab } }
  | { type: 'history/rerun'; payload: { entry: SqlQueryHistoryEntry } }
