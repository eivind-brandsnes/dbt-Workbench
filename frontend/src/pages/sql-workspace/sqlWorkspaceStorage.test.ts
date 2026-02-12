import { describe, expect, it, beforeEach } from 'vitest'

import {
  getSqlWorkspaceStorageKey,
  loadSqlWorkspaceState,
  saveSqlWorkspaceState,
} from './sqlWorkspaceStorage'

describe('sqlWorkspaceStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('migrates legacy v1 state into scoped v2 storage', () => {
    window.localStorage.setItem(
      'dbt-workbench-sql-workspace',
      JSON.stringify({
        sqlText: 'select 1',
        environmentId: 2,
        mode: 'sql',
        editorTheme: 'light',
      }),
    )

    const migrated = loadSqlWorkspaceState(42)

    expect(migrated).not.toBeNull()
    expect(migrated?.version).toBe(2)
    expect(migrated?.environmentId).toBe(2)
    expect(migrated?.editorTheme).toBe('light')
    expect(migrated?.tabs[0].sqlText).toBe('select 1')

    const persisted = window.localStorage.getItem(getSqlWorkspaceStorageKey(42))
    expect(persisted).not.toBeNull()
  })

  it('saves and loads workspace-scoped v2 state', () => {
    const state = {
      version: 2 as const,
      tabs: [
        {
          id: 'tab-1',
          title: 'SQL 1',
          mode: 'sql' as const,
          sqlText: 'select 2',
          sourceFilePath: null,
          selectedModelId: null,
          isDirty: false,
          isReadonly: false,
          lastUsedAt: Date.now(),
        },
      ],
      activeTabId: 'tab-1',
      environmentId: 3,
      editorTheme: 'dark' as const,
      activeBottomPanel: 'history' as const,
      layout: {
        leftPaneWidth: 340,
        bottomPaneHeight: 300,
        isEditorFocused: true,
      },
    }

    saveSqlWorkspaceState(7, state)

    const loaded = loadSqlWorkspaceState(7)
    const otherWorkspace = loadSqlWorkspaceState(8)

    expect(loaded).toMatchObject({
      version: 2,
      activeTabId: 'tab-1',
      environmentId: 3,
      activeBottomPanel: 'history',
      editorTheme: 'dark',
    })
    expect(otherWorkspace).toBeNull()
  })

  it('sanitizes out-of-range pane sizes when loading', () => {
    const key = getSqlWorkspaceStorageKey(5)
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        tabs: [
          {
            id: 'tab-1',
            title: 'SQL 1',
            mode: 'sql',
            sqlText: '',
            sourceFilePath: null,
            selectedModelId: null,
            isDirty: false,
            isReadonly: false,
            lastUsedAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
        environmentId: null,
        editorTheme: 'dark',
        activeBottomPanel: 'results',
        layout: {
          leftPaneWidth: 9000,
          bottomPaneHeight: -10,
          isEditorFocused: false,
        },
      }),
    )

    const loaded = loadSqlWorkspaceState(5)
    expect(loaded?.layout.leftPaneWidth).toBe(520)
    expect(loaded?.layout.bottomPaneHeight).toBe(180)
  })
})
