import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import DocsPage from '../Docs'
import { api } from '../../api/client'

vi.mock('../../api/client', () => ({
  api: { get: vi.fn(), defaults: { baseURL: 'http://localhost:8000' } },
}))

const mockedApi = api as { get: ReturnType<typeof vi.fn>; defaults: { baseURL: string } }

describe('DocsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows empty state when docs are missing', async () => {
    mockedApi.get = vi.fn().mockResolvedValue({
      data: { manifest: true, run_results: true, catalog: true, docs: false },
    })

    render(<DocsPage />)

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())
    expect(screen.getByText(/Docs not found/)).toBeInTheDocument()
  })

  it('renders iframe when docs are available', async () => {
    mockedApi.get = vi.fn().mockResolvedValue({
      data: { manifest: true, run_results: true, catalog: true, docs: true },
    })

    render(<DocsPage />)

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())
    const iframe = screen.getByTitle('dbt Docs')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', 'http://localhost:8000/artifacts/docs/index.html')
  })
})
