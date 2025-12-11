import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import LineagePage from './Lineage'
import { api } from '../api/client'

vi.mock('../api/client', () => {
  return {
    api: {
      get: vi.fn(),
    },
  }
})

const mockedGet = api.get as unknown as ReturnType<typeof vi.fn>

const sampleGraph = {
  nodes: [
    { id: 'model.one', label: 'one', type: 'model', schema: 'analytics' },
    { id: 'model.two', label: 'two', type: 'model', schema: 'analytics' },
  ],
  edges: [{ source: 'model.one', target: 'model.two' }],
  groups: [
    { id: 'schema:db.analytics', label: 'db.analytics', type: 'schema', members: ['model.one', 'model.two'] },
  ],
}

const sampleColumnGraph = {
  nodes: [{ id: 'model.two.id', column: 'id', model_id: 'model.two', label: 'two:id', type: 'model' }],
  edges: [],
}

const sampleImpact = { upstream: ['model.one'], downstream: ['model.two'] }

const sampleModelDetail = {
  model_id: 'model.two',
  parents: ['model.one'],
  children: [],
  columns: { id: { description: 'identifier' } },
  tags: ['core'],
  schema: 'analytics',
  database: 'db',
}

describe('LineagePage', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockImplementation((url: string) => {
      if (url.startsWith('/config')) return Promise.resolve({ data: { lineage: {} } })
      if (url.startsWith('/lineage/graph')) return Promise.resolve({ data: sampleGraph })
      if (url.startsWith('/lineage/columns')) return Promise.resolve({ data: sampleColumnGraph })
      if (url.startsWith('/lineage/upstream/model.two')) return Promise.resolve({ data: sampleImpact })
      if (url.startsWith('/lineage/model/model.two')) return Promise.resolve({ data: sampleModelDetail })
      return Promise.resolve({ data: {} })
    })
  })

  it('renders lineage graph nodes and grouping controls', async () => {
    render(
      <MemoryRouter>
        <LineagePage />
      </MemoryRouter>
    )

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    expect(await screen.findByText('Lineage')).toBeInTheDocument()
    expect(await screen.findByText('one')).toBeInTheDocument()
    expect(screen.getByText('Grouping')).toBeInTheDocument()
  })

  it('allows selecting a model and viewing column-level details', async () => {
    render(
      <MemoryRouter>
        <LineagePage />
      </MemoryRouter>
    )
    await waitFor(() => screen.findByText('two'))

    fireEvent.click(screen.getByText('two'))

    const labels = await screen.findAllByText('model.two')
    expect(labels.length).toBeGreaterThan(0)
    expect(screen.getByText('Parents: 1 | Children: 0')).toBeInTheDocument()

    const columnButton = await screen.findByText('id')
    fireEvent.click(columnButton)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('/lineage/upstream/model.two')))
  })
})
