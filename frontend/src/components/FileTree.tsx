import React, { useEffect, useMemo, useRef, useState } from 'react'

import { GitFileNode } from '../types'
import {
  buildFileTree,
  collectFolderPaths,
  filterFileTree,
  flattenFileTree,
  getAncestorPaths,
} from '../utils/fileTree'

const highlightMatch = (name: string, query: string) => {
  if (!query.trim()) return name
  const lower = name.toLowerCase()
  const needle = query.trim().toLowerCase()
  const index = lower.indexOf(needle)
  if (index === -1) return name

  const before = name.slice(0, index)
  const match = name.slice(index, index + needle.length)
  const after = name.slice(index + needle.length)

  return (
    <>
      {before}
      <mark className="bg-accent/30 text-accent font-semibold rounded px-0.5">{match}</mark>
      {after}
    </>
  )
}

type FileTreeProps = {
  nodes: GitFileNode[]
  onSelect: (path: string) => void
  selectedPath?: string
  emptyMessage?: string
  storageKey?: string
}

export const FileTree = ({
  nodes,
  onSelect,
  selectedPath,
  emptyMessage = 'No files found.',
  storageKey = 'project-files',
}: FileTreeProps) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const storageKeyRef = useRef(storageKey)

  const readExpandedFromStorage = (key: string) => {
    if (typeof window === 'undefined') return new Set<string>()
    const raw = sessionStorage.getItem(`file-tree-expanded:${key}`)
    if (!raw) return new Set<string>()
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed)
      }
    } catch {
      return new Set<string>()
    }
    return new Set<string>()
  }

  const [expanded, setExpanded] = useState<Set<string>>(() => readExpandedFromStorage(storageKey))

  const tree = useMemo(() => buildFileTree(nodes), [nodes])

  useEffect(() => {
    if (storageKeyRef.current === storageKey) return
    storageKeyRef.current = storageKey
    setExpanded(readExpandedFromStorage(storageKey))
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(`file-tree-expanded:${storageKey}`, JSON.stringify(Array.from(expanded)))
  }, [expanded, storageKey])

  useEffect(() => {
    if (!selectedPath) return
    const ancestors = getAncestorPaths(selectedPath)
    if (ancestors.length === 0) return
    setExpanded((prev) => {
      const next = new Set(prev)
      ancestors.forEach((path) => next.add(path))
      return next
    })
  }, [selectedPath])

  const { filtered, expanded: searchExpanded } = useMemo(
    () => filterFileTree(tree, filterQuery),
    [tree, filterQuery],
  )

  const effectiveExpanded = useMemo(() => {
    if (!filterQuery.trim()) return expanded
    const combined = new Set(expanded)
    searchExpanded.forEach((path) => combined.add(path))
    return combined
  }, [expanded, filterQuery, searchExpanded])

  const rows = useMemo(
    () => flattenFileTree(filtered, effectiveExpanded),
    [filtered, effectiveExpanded],
  )

  const focusRow = (index: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-file-tree-item="true"]')
    if (!items || items.length === 0) return
    const target = items[index]
    if (target) {
      target.focus()
    }
  }

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpanded(new Set(collectFolderPaths(tree)))
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.target.value)}
          placeholder="Filter files"
          className="panel-input flex-1 rounded px-2 py-1 text-xs"
          aria-label="Filter files"
        />
        <button
          type="button"
          onClick={expandAll}
          className="text-[11px] text-muted hover:text-text"
        >
          Expand all
        </button>
        <span className="text-muted">/</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-[11px] text-muted hover:text-text"
        >
          Collapse all
        </button>
      </div>
      <div ref={listRef} className="space-y-1">
        {rows.map(({ node, depth }, index) => {
          const isSelected = node.type === 'file' && selectedPath === node.path
          const isExpanded = node.type === 'folder' && effectiveExpanded.has(node.path)
          const chevron = node.type === 'folder' ? (isExpanded ? '▾' : '▸') : '•'
          return (
            <button
              key={node.id}
              type="button"
              data-file-tree-item="true"
              data-index={index}
              aria-expanded={node.type === 'folder' ? isExpanded : undefined}
              onClick={() => {
                if (node.type === 'folder') {
                  toggleFolder(node.path)
                } else {
                  onSelect(node.path)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (node.type === 'folder') {
                    toggleFolder(node.path)
                  } else {
                    onSelect(node.path)
                  }
                }
                if (event.key === 'ArrowRight' && node.type === 'folder') {
                  event.preventDefault()
                  setExpanded((prev) => new Set(prev).add(node.path))
                }
                if (event.key === 'ArrowLeft' && node.type === 'folder') {
                  event.preventDefault()
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    next.delete(node.path)
                    return next
                  })
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  focusRow(index + 1)
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  focusRow(index - 1)
                }
              }}
              className={`w-full text-left px-2 py-1 rounded border border-border hover:bg-panel/70 text-xs text-text flex items-center gap-2 ${
                isSelected ? 'bg-panel/75 text-text border-border' : 'bg-surface-muted/55'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <span className="text-muted w-4 inline-flex justify-center">{chevron}</span>
              <span className="flex-1 truncate">
                {node.type === 'file' && node.category ? (
                  <span className="font-mono text-[10px] text-muted mr-1">[{node.category}]</span>
                ) : null}
                {highlightMatch(node.name, filterQuery)}
              </span>
            </button>
          )
        })}
        {rows.length === 0 && <div className="text-xs text-muted">{emptyMessage}</div>}
      </div>
    </div>
  )
}
