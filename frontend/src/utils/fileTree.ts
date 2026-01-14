import { GitFileNode } from '../types'

export type FileTreeNode = {
  id: string
  name: string
  path: string
  type: 'folder' | 'file'
  category?: string | null
  children?: FileTreeNode[]
  meta?: GitFileNode
}

export type FileTreeRow = {
  node: FileTreeNode
  depth: number
}

const compareNames = (a: FileTreeNode, b: FileTreeNode) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export const sortFileTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
  const sorted = nodes
    .slice()
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return compareNames(a, b)
    })
    .map((node) => {
      if (node.type === 'folder' && node.children) {
        return { ...node, children: sortFileTree(node.children) }
      }
      return node
    })

  return sorted
}

export const buildFileTree = (nodes: GitFileNode[]): FileTreeNode[] => {
  const root: FileTreeNode = {
    id: '',
    name: '',
    path: '',
    type: 'folder',
    children: [],
  }
  const folderMap = new Map<string, FileTreeNode>()
  folderMap.set('', root)

  nodes.forEach((node) => {
    const segments = node.path.split('/').filter(Boolean)
    if (segments.length === 0) return

    let currentPath = ''
    let parent = root

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const isFile = index === segments.length - 1

      if (isFile) {
        parent.children?.push({
          id: currentPath,
          name: segment,
          path: currentPath,
          type: 'file',
          category: node.category ?? null,
          meta: node,
        })
        return
      }

      let folder = folderMap.get(currentPath)
      if (!folder) {
        folder = {
          id: currentPath,
          name: segment,
          path: currentPath,
          type: 'folder',
          children: [],
        }
        folderMap.set(currentPath, folder)
        parent.children?.push(folder)
      }
      parent = folder
    })
  })

  return sortFileTree(root.children ?? [])
}

export const getAncestorPaths = (path: string): string[] => {
  const segments = path.split('/').filter(Boolean)
  if (segments.length <= 1) return []
  const ancestors: string[] = []
  let current = ''
  segments.slice(0, -1).forEach((segment) => {
    current = current ? `${current}/${segment}` : segment
    ancestors.push(current)
  })
  return ancestors
}

export const filterFileTree = (
  nodes: FileTreeNode[],
  query: string,
): { filtered: FileTreeNode[]; expanded: Set<string> } => {
  const expanded = new Set<string>()
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return { filtered: nodes, expanded }
  }

  const filterNodes = (items: FileTreeNode[]): FileTreeNode[] => {
    const matches: FileTreeNode[] = []
    items.forEach((item) => {
      const nameMatches = item.name.toLowerCase().includes(normalized)

      if (item.type === 'folder') {
        const children = item.children ? filterNodes(item.children) : []
        if (children.length > 0) {
          expanded.add(item.path)
        }
        if (nameMatches || children.length > 0) {
          matches.push({ ...item, children })
        }
        return
      }

      if (nameMatches) {
        matches.push(item)
      }
    })
    return matches
  }

  return { filtered: filterNodes(nodes), expanded }
}

export const flattenFileTree = (
  nodes: FileTreeNode[],
  expanded: Set<string>,
  depth = 0,
): FileTreeRow[] => {
  const rows: FileTreeRow[] = []

  nodes.forEach((node) => {
    rows.push({ node, depth })
    if (node.type === 'folder' && node.children && expanded.has(node.path)) {
      rows.push(...flattenFileTree(node.children, expanded, depth + 1))
    }
  })

  return rows
}

export const collectFolderPaths = (nodes: FileTreeNode[]): string[] => {
  const paths: string[] = []
  nodes.forEach((node) => {
    if (node.type === 'folder') {
      paths.push(node.path)
      if (node.children) {
        paths.push(...collectFolderPaths(node.children))
      }
    }
  })
  return paths
}
