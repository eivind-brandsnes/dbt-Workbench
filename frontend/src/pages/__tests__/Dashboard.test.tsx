import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import DashboardPage from '../Dashboard'
import { api } from '../../api/client'

vi.mock('../../api/client', () => ({ api: { get: vi.fn() } }))
const mockedApi = api as { get: ReturnType<typeof vi.fn> }

describe('DashboardPage', () => {
  it('shows fallback when health is unavailable', async () => {
    mockedApi.get = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: { manifest: false, run_results: false, catalog: false } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Manifest:/)).toBeInTheDocument()
  })
})
