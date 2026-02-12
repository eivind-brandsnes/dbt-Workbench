import React from 'react'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, beforeEach } from 'vitest'

import SqlWorkspacePage from './SqlWorkspace'
import { SqlWorkspaceService } from '@/services/sqlWorkspaceService'
import { SchedulerService } from '@/services/schedulerService'
import { GitService } from '@/services/gitService'

vi.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange?: (val: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}))

vi.mock('@/hooks/useAutoRefresh', () => ({
  useAutoRefresh: () => ({
    checkNow: vi.fn(),
    getCurrentVersions: vi.fn(),
    getVersionInfo: vi.fn(),
  }),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthEnabled: false,
    user: { id: 1, username: 'dev', role: 'developer' },
    activeWorkspace: { id: 1, key: 'demo', name: 'Demo', artifacts_path: '/tmp/artifacts' },
    workspaces: [{ id: 1, key: 'demo', name: 'Demo', artifacts_path: '/tmp/artifacts' }],
    switchWorkspace: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/services/sqlWorkspaceService', () => ({
  SqlWorkspaceService: {
    executeQuery: vi.fn(),
    executeModel: vi.fn(),
    getMetadata: vi.fn(),
    getHistory: vi.fn(),
    getCompiledSql: vi.fn(),
    previewModel: vi.fn(),
    deleteHistoryEntry: vi.fn(),
  },
}))

vi.mock('@/services/schedulerService', () => ({
  SchedulerService: {
    listEnvironments: vi.fn(),
  },
}))

vi.mock('@/services/gitService', () => ({
  GitService: {
    status: vi.fn(),
    files: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}))

const mockedSqlService = vi.mocked(SqlWorkspaceService)
const mockedScheduler = vi.mocked(SchedulerService)
const mockedGit = vi.mocked(GitService)

const renderPage = () =>
  render(
    <BrowserRouter>
      <SqlWorkspacePage />
    </BrowserRouter>,
  )

describe('SqlWorkspacePage editor controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const now = new Date().toISOString()
    mockedScheduler.listEnvironments.mockResolvedValue([
      { id: 1, name: 'Dev', description: 'dev env', variables: {}, created_at: now, updated_at: now },
    ])

    mockedSqlService.getMetadata.mockResolvedValue({
      models: [
        {
          unique_id: 'model.project.example',
          name: 'example',
          relation_name: 'analytics.example',
          resource_type: 'model',
          columns: [],
          tags: [],
          meta: {},
          original_file_path: 'models/example.sql',
        },
      ],
      sources: [],
      schemas: {},
    })
    mockedSqlService.getHistory.mockResolvedValue({ items: [], total_count: 0, page: 1, page_size: 20 })
    mockedSqlService.executeQuery.mockResolvedValue({
      query_id: 'run-1',
      rows: [],
      columns: [],
      execution_time_ms: 10,
      row_count: 0,
      truncated: false,
      profiling: { row_count: 0, columns: [] },
    })
    mockedSqlService.executeModel.mockResolvedValue({
      query_id: 'model-run',
      rows: [],
      columns: [],
      execution_time_ms: 10,
      row_count: 0,
      truncated: false,
      profiling: { row_count: 0, columns: [] },
    })
    mockedSqlService.getCompiledSql.mockResolvedValue({
      model_unique_id: 'model.project.example',
      compiled_sql: 'select 1 as value',
      source_sql: 'select {{ 1 }} as value',
      compiled_sql_checksum: 'checksum',
      environment_id: 1,
      target_name: 'dev',
      original_file_path: 'models/example.sql',
    })

    mockedGit.status.mockResolvedValue({
      branch: 'main',
      is_clean: true,
      ahead: 0,
      behind: 0,
      changes: [],
      has_conflicts: false,
      configured: true,
    })
    mockedGit.files.mockResolvedValue([])
  })

  it('shows the toolbar action bar without row limit or profiling toggles', async () => {
    renderPage()

    await waitFor(() => expect(mockedSqlService.getMetadata).toHaveBeenCalled())

    expect(screen.queryByText(/Row limit/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Enable profiling/i)).not.toBeInTheDocument()

    const actionBar = await screen.findByTestId('editor-action-bar')
    const actionButtons = within(actionBar).getAllByRole('button').map((btn) => btn.textContent)

    expect(actionButtons).toContain('Run')
    expect(actionButtons).toContain('New SQL Tab')
    expect(actionButtons).toContain('Save')
  })

  it('sends profiling-enabled SQL requests without a row limit override', async () => {
    renderPage()

    await waitFor(() => expect(mockedSqlService.getMetadata).toHaveBeenCalled())

    const editor = await screen.findByTestId('code-editor')
    fireEvent.change(editor, { target: { value: 'select 1' } })

    const runButton = await screen.findByRole('button', { name: /^Run$/ })
    fireEvent.click(runButton)

    await waitFor(() => expect(mockedSqlService.executeQuery).toHaveBeenCalled())
    const payload = mockedSqlService.executeQuery.mock.calls[0][0]

    expect(payload.include_profiling).toBe(true)
    expect('row_limit' in payload).toBe(false)
  })

  it('executes compiled SQL for dbt model files loaded from the repository', async () => {
    mockedGit.files.mockResolvedValue([
      { name: 'example.sql', path: 'models/example.sql', type: 'file', category: 'models' },
    ])
    mockedGit.readFile.mockResolvedValue({ path: 'models/example.sql', content: 'select {{ 1 }}', readonly: false })

    renderPage()

    const filterInput = await screen.findByLabelText('Filter files')
    const treeRoot = filterInput.closest('div')?.parentElement
    expect(treeRoot).toBeTruthy()
    const treeScope = within(treeRoot as HTMLElement)

    await userEvent.click(treeScope.getByText('Expand all'))

    await waitFor(() => {
      const fileButton = treeScope.getAllByRole('button').find((button) =>
        button.textContent?.includes('example.sql'),
      )
      expect(fileButton).toBeTruthy()
    })

    const fileButton = treeScope.getAllByRole('button').find((button) =>
      button.textContent?.includes('example.sql'),
    )
    expect(fileButton).toBeTruthy()
    await userEvent.click(fileButton as HTMLElement)

    const runButton = await screen.findByRole('button', { name: /^Run$/ })
    fireEvent.click(runButton)

    await waitFor(() => expect(mockedSqlService.executeModel).toHaveBeenCalled())
  })

  it('warns when compiled SQL is unavailable for a selected model', async () => {
    mockedGit.files.mockResolvedValue([
      { name: 'example.sql', path: 'models/example.sql', type: 'file', category: 'models' },
    ])
    mockedGit.readFile.mockResolvedValue({ path: 'models/example.sql', content: 'select {{ 1 }}', readonly: false })
    mockedSqlService.getCompiledSql.mockResolvedValue({
      model_unique_id: 'model.project.example',
      compiled_sql: '',
      source_sql: 'select {{ 1 }}',
      compiled_sql_checksum: '',
      environment_id: 1,
    })

    renderPage()

    const filterInput = await screen.findByLabelText('Filter files')
    const treeRoot = filterInput.closest('div')?.parentElement
    expect(treeRoot).toBeTruthy()
    const treeScope = within(treeRoot as HTMLElement)

    await userEvent.click(treeScope.getByText('Expand all'))

    await waitFor(() => {
      const fileButton = treeScope.getAllByRole('button').find((button) =>
        button.textContent?.includes('example.sql'),
      )
      expect(fileButton).toBeTruthy()
    })

    const fileButton = treeScope.getAllByRole('button').find((button) =>
      button.textContent?.includes('example.sql'),
    )
    expect(fileButton).toBeTruthy()
    await userEvent.click(fileButton as HTMLElement)

    const runButton = await screen.findByRole('button', { name: /^Run$/ })
    fireEvent.click(runButton)

    await waitFor(() =>
      expect(
        screen.getByText(
          /Compiled SQL is not available for the selected model\. Run "dbt compile" to generate artifacts, then try again\./,
        ),
      ).toBeInTheDocument(),
    )
    expect(mockedSqlService.executeModel).not.toHaveBeenCalled()
  })
})
