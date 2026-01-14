import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FileTree } from './FileTree'

const nodes = [
  { name: 'stg_orders.sql', path: 'models/staging/stg_orders.sql', type: 'file', category: 'models' },
  { name: 'base.sql', path: 'models/base/base.sql', type: 'file', category: 'models' },
]

describe('FileTree', () => {
  it('expands folders and selects files', async () => {
    const onSelect = vi.fn()
    render(<FileTree nodes={nodes} onSelect={onSelect} storageKey="test-tree" />)

    expect(screen.getByText('models')).toBeInTheDocument()
    expect(screen.queryByText('stg_orders.sql')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('models'))
    expect(await screen.findByText('staging')).toBeInTheDocument()

    await userEvent.click(screen.getByText('staging'))
    await userEvent.click(screen.getByText('stg_orders.sql'))

    expect(onSelect).toHaveBeenCalledWith('models/staging/stg_orders.sql')
  })

  it('filters and auto-expands matching folders', async () => {
    render(<FileTree nodes={nodes} onSelect={vi.fn()} storageKey="test-tree-filter" />)

    await userEvent.type(screen.getByLabelText('Filter files'), 'orders')

    const fileButtons = await screen.findAllByRole('button')
    const matchingFile = fileButtons.find((button) =>
      button.textContent?.includes('stg_orders.sql'),
    )
    expect(matchingFile).toBeTruthy()
    expect(screen.getByText('staging')).toBeInTheDocument()
  })
})
