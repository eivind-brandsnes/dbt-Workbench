import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ModelsPage from '../Models'
import { vi } from 'vitest'
import { api } from '../../api/client'

vi.mock('../../api/client', () => ({ api: { get: vi.fn() } }))
const mockedApi = api as { get: ReturnType<typeof vi.fn> }

const models = [
  { unique_id: 'model.a', name: 'a', resource_type: 'model', depends_on: [], database: 'db', schema: 'public', alias: 'a' },
  { unique_id: 'model.b', name: 'b', resource_type: 'model', depends_on: ['model.a'], database: 'db', schema: 'public', alias: 'b' },
]

describe('ModelsPage', () => {
  beforeEach(() => {
    mockedApi.get = vi.fn().mockResolvedValue({ data: models })
  })

  it('filters models by search query', async () => {
    render(
      <BrowserRouter>
        <ModelsPage />
      </BrowserRouter>
    )

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('Search models'), { target: { value: 'a' } })
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByText('b')).not.toBeInTheDocument()
  })
})
