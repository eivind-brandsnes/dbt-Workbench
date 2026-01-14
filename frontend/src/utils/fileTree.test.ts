import { describe, expect, it } from 'vitest'

import {
  buildFileTree,
  collectFolderPaths,
  filterFileTree,
  flattenFileTree,
} from './fileTree'

const sampleNodes = [
  { name: 'stg_orders.sql', path: 'models/staging/stg_orders.sql', type: 'file', category: 'models' },
  { name: 'base.sql', path: 'models/base/base.sql', type: 'file', category: 'models' },
  { name: 'dbt_project.yml', path: 'dbt_project.yml', type: 'file', category: 'configs' },
  { name: 'README.md', path: 'models/README.md', type: 'file', category: 'docs' },
]

describe('fileTree utils', () => {
  it('builds a hierarchical tree with folders sorted before files', () => {
    const tree = buildFileTree(sampleNodes)

    expect(tree[0].type).toBe('folder')
    expect(tree[0].name).toBe('models')
    expect(tree[1].name).toBe('dbt_project.yml')

    const models = tree[0]
    expect(models.children?.map((child) => child.name)).toEqual(['base', 'staging', 'README.md'])
    expect(models.children?.[2].type).toBe('file')
  })

  it('preserves file categories on nodes', () => {
    const tree = buildFileTree(sampleNodes)
    const models = tree[0]
    const readme = models.children?.find((child) => child.name === 'README.md')
    expect(readme?.category).toBe('docs')
  })

  it('filters by query and auto-expands matching ancestors', () => {
    const tree = buildFileTree(sampleNodes)
    const { filtered, expanded } = filterFileTree(tree, 'orders')
    const rows = flattenFileTree(filtered, expanded)

    expect(rows.map((row) => row.node.name)).toEqual(['models', 'staging', 'stg_orders.sql'])
    expect(expanded.has('models')).toBe(true)
    expect(expanded.has('models/staging')).toBe(true)
  })

  it('flattens only expanded folders', () => {
    const tree = buildFileTree(sampleNodes)
    const rows = flattenFileTree(tree, new Set(['models']))
    const rowNames = rows.map((row) => row.node.name)

    expect(rowNames).toContain('models')
    expect(rowNames).toContain('base')
    expect(rowNames).toContain('staging')
    expect(rowNames).not.toContain('stg_orders.sql')
  })

  it('collects all folder paths for expand-all behavior', () => {
    const tree = buildFileTree(sampleNodes)
    const folders = collectFolderPaths(tree)

    expect(folders).toEqual(['models', 'models/base', 'models/staging'])
  })
})
