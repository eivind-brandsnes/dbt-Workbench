import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { RunCommand } from './RunCommand'
import { api } from '../api/client'
import { ExecutionService } from '../services/executionService'
import { EnvironmentService } from '../services/environmentService'
import { ArtifactService } from '../services/artifactService'

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }))
vi.mock('../services/executionService', () => ({
  ExecutionService: {
    startRun: vi.fn(),
    getRunStatus: vi.fn(),
    checkPackages: vi.fn(),
    installPackages: vi.fn(),
    createLogStream: vi.fn(),
  },
}))
vi.mock('../services/environmentService', () => ({ EnvironmentService: { list: vi.fn() } }))
vi.mock('../services/artifactService', () => ({ ArtifactService: { getSeedStatus: vi.fn() } }))

const mockedApi = api as { get: ReturnType<typeof vi.fn> }
const mockedExecutionService = ExecutionService as {
  startRun: ReturnType<typeof vi.fn>
  getRunStatus: ReturnType<typeof vi.fn>
  checkPackages: ReturnType<typeof vi.fn>
  installPackages: ReturnType<typeof vi.fn>
  createLogStream: ReturnType<typeof vi.fn>
}
const mockedEnvironmentService = EnvironmentService as { list: ReturnType<typeof vi.fn> }
const mockedArtifactService = ArtifactService as { getSeedStatus: ReturnType<typeof vi.fn> }

const authValue = {
  isLoading: false,
  isAuthEnabled: false,
  user: { id: 1, username: 'tester', role: 'admin' },
  activeWorkspace: { id: 1, key: 'default', name: 'Default', artifacts_path: '/tmp' },
  workspaces: [{ id: 1, key: 'default', name: 'Default', artifacts_path: '/tmp' }],
  accessToken: null,
  refreshToken: null,
  login: vi.fn(),
  logout: vi.fn(),
  switchWorkspace: vi.fn(),
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

  describe('RunCommand', () => {
  const selectTarget = async () => {
    const targetInput = await screen.findByPlaceholderText('e.g., dev')
    await userEvent.type(targetInput, 'dev')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllMocks()
    mockedApi.get.mockResolvedValue({ data: [] })
    mockedEnvironmentService.list.mockResolvedValue([
      {
        id: 1,
        name: 'Dev',
        description: 'Dev env',
        created_at: '',
        updated_at: '',
        dbt_target_name: 'dev',
        connection_profile_reference: 'dev-profile',
        variables: {},
        default_retention_policy: null,
      },
    ])
    mockedExecutionService.startRun.mockResolvedValue({ run_id: '123', status: 'succeeded' })
    mockedExecutionService.getRunStatus.mockResolvedValue({ run_id: '123', status: 'succeeded' })
    mockedArtifactService.getSeedStatus.mockResolvedValue({
      seed_present: false,
      seed_dependency_detected: false,
      seed_run_executed: false,
      warning: false,
    })
  })

  it('starts the selected command when an action button is clicked', async () => {
    const onRunStarted = vi.fn()
    render(<RunCommand onRunStarted={onRunStarted} />)

    await selectTarget()
    await userEvent.click(screen.getByTestId('run-execute'))

    await waitFor(() => expect(mockedExecutionService.startRun).toHaveBeenCalled())
    expect(mockedExecutionService.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'run' })
    )
    expect(onRunStarted).toHaveBeenCalledWith('123')
  })

  it('passes command-specific options with the executed command', async () => {
    render(<RunCommand />)

    await userEvent.click(screen.getByLabelText('Store Failures (dbt test only)'))
    await selectTarget()
    await userEvent.click(screen.getByTestId('test-execute'))

    await waitFor(() => expect(mockedExecutionService.startRun).toHaveBeenCalled())
    const runRequest = mockedExecutionService.startRun.mock.calls[0][0]
    expect(runRequest.command).toBe('test')
    expect(runRequest.parameters.store_failures).toBe(true)
  })

  it('ignores incompatible options for other commands', async () => {
    render(<RunCommand />)

    await userEvent.click(screen.getByLabelText('Store Failures (dbt test only)'))
    await userEvent.click(screen.getByLabelText('No Compile (dbt docs generate only)'))
    await selectTarget()
    await userEvent.click(screen.getByTestId('seed-execute'))

    await waitFor(() => expect(mockedExecutionService.startRun).toHaveBeenCalled())
    const runRequest = mockedExecutionService.startRun.mock.calls[0][0]
    expect(runRequest.command).toBe('seed')
    expect(runRequest.parameters).not.toHaveProperty('store_failures')
    expect(runRequest.parameters).not.toHaveProperty('no_compile')
  })

  it('applies docs specific options only when docs are executed', async () => {
    render(<RunCommand />)

    await userEvent.click(screen.getByLabelText('No Compile (dbt docs generate only)'))
    await selectTarget()
    await userEvent.click(screen.getByTestId('docs generate-execute'))

    await waitFor(() => expect(mockedExecutionService.startRun).toHaveBeenCalled())
    const runRequest = mockedExecutionService.startRun.mock.calls[0][0]
    expect(runRequest.command).toBe('docs generate')
    expect(runRequest.parameters.no_compile).toBe(true)
  })

  it('warns when seeds are required before running other commands', async () => {
    mockedArtifactService.getSeedStatus.mockResolvedValueOnce({
      seed_present: true,
      seed_dependency_detected: true,
      seed_run_executed: false,
      warning: true,
    })

    render(<RunCommand />)

    await selectTarget()
    await userEvent.click(screen.getByTestId('run-execute'))

    expect(mockedExecutionService.startRun).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Seeds are required for downstream models. Run dbt seed before running other commands.'
      )
    ).toBeInTheDocument()
  })

  it('requires a target before executing any command', async () => {
    render(<RunCommand />)

    await userEvent.click(screen.getByTestId('run-execute'))

    expect(mockedExecutionService.startRun).not.toHaveBeenCalled()
    expect(await screen.findByText('Select a Target before running a dbt command.')).toBeInTheDocument()
  })

  it('passes run_row_lineage when the checkbox is selected', async () => {
    render(<RunCommand />)

    await userEvent.click(screen.getByLabelText('Run Row Lineage (dbt-rowlineage)'))
    await selectTarget()
    await userEvent.click(screen.getByTestId('run-execute'))

    await waitFor(() => expect(mockedExecutionService.startRun).toHaveBeenCalled())
    const runRequest = mockedExecutionService.startRun.mock.calls[0][0]
    expect(runRequest.run_row_lineage).toBe(true)
  })

  it('uses the purple background styling on the command panel', () => {
    const { container } = render(<RunCommand />)

    const panel = container.firstElementChild as HTMLElement | null
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('bg-blue-50')
  })

  describe('Package Checking', () => {
    it('shows modal when missing packages detected', async () => {
      mockedExecutionService.checkPackages.mockResolvedValue({
        has_missing: true,
        packages_required: ['dbt-utils'],
        packages_installed: [],
        missing_packages: ['dbt-utils'],
        packages_yml_exists: true,
      })

      const onRunStarted = vi.fn()
      render(<RunCommand onRunStarted={onRunStarted} />)

      await selectTarget()
      await userEvent.click(screen.getByTestId('run-execute'))

      await waitFor(() => {
        expect(screen.queryByText('Missing dbt Packages')).toBeInTheDocument()
        expect(screen.getByText('dbt-utils')).toBeInTheDocument()
      })
      expect(mockedExecutionService.startRun).not.toHaveBeenCalled()
    })

    it('proceeds normally when no missing packages', async () => {
      mockedExecutionService.checkPackages.mockResolvedValue({
        has_missing: false,
        packages_required: [],
        packages_installed: [],
        missing_packages: [],
        packages_yml_exists: false,
      })

      const onRunStarted = vi.fn()
      render(<RunCommand onRunStarted={onRunStarted} />)

      await selectTarget()
      await userEvent.click(screen.getByTestId('run-execute'))

      await waitFor(() => {
        expect(screen.queryByText('Missing dbt Packages')).not.toBeInTheDocument()
        expect(mockedExecutionService.startRun).toHaveBeenCalled()
      })
      expect(onRunStarted).toHaveBeenCalledWith('123')
    })

    it('does not check packages for seed command', async () => {
      mockedExecutionService.checkPackages.mockResolvedValue({
        has_missing: true,
        packages_required: ['dbt-utils'],
        packages_installed: [],
        missing_packages: ['dbt-utils'],
        packages_yml_exists: true,
      })

      render(<RunCommand />)

      await selectTarget()
      await userEvent.click(screen.getByTestId('seed-execute'))

      await waitFor(() => {
        expect(mockedExecutionService.checkPackages).toHaveBeenCalled()
        expect(mockedExecutionService.startRun).toHaveBeenCalled()
      })
    })

    it('displays installed packages list in modal', async () => {
      mockedExecutionService.checkPackages.mockResolvedValue({
        has_missing: true,
        packages_required: ['dbt-utils', 'dbt-expectations'],
        packages_installed: ['dbt-expectations'],
        missing_packages: ['dbt-utils'],
        packages_yml_exists: true,
      })

      render(<RunCommand />)

      await selectTarget()
      await userEvent.click(screen.getByTestId('run-execute'))

      await waitFor(() => {
        expect(screen.getByText('Installed Packages')).toBeInTheDocument()
        expect(screen.getByText('dbt-expectations')).toBeInTheDocument()
      })
    })

    it('shows correct count of missing packages in modal', async () => {
      mockedExecutionService.checkPackages.mockResolvedValue({
        has_missing: true,
        packages_required: ['dbt-utils', 'dbt-expectations', 'dbt-codegen'],
        packages_installed: ['dbt-expectations'],
        missing_packages: ['dbt-utils', 'dbt-codegen'],
        packages_yml_exists: true,
      })

      render(<RunCommand />)

      await selectTarget()
      await userEvent.click(screen.getByTestId('run-execute'))

      await waitFor(() => {
        expect(screen.getByText(/2 of 3 required packages are not installed/i)).toBeInTheDocument()
      })
    })
  })
})
