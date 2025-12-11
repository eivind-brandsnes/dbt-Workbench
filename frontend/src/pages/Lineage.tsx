import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import {
  ColumnLineageGraph,
  ColumnNode,
  ImpactResponse,
  LineageEdge,
  LineageGraph,
  LineageGroup,
  LineageNode,
  ModelDetail,
} from '../types'

type GroupingMode = 'none' | 'schema' | 'resource_type' | 'tag'
type ViewMode = 'model' | 'column'

type PositionedNode<T extends LineageNode | ColumnNode> = T & { x: number; y: number; isGroup?: boolean; isSubtree?: boolean }

type VisibleGraph<T extends LineageNode | ColumnNode> = {
  nodes: PositionedNode<T>[]
  edges: LineageEdge[]
}

type LineageConfig = {
  default_grouping_mode?: GroupingMode
  max_initial_depth?: number
  load_column_lineage_by_default?: boolean
  performance_mode?: string
}

const canvas = { width: 1200, height: 720 }
const emptyImpact: ImpactResponse = { upstream: [], downstream: [] }
const normalizeImpact = (value?: Partial<ImpactResponse>): ImpactResponse => ({
  upstream: value?.upstream ?? [],
  downstream: value?.downstream ?? [],
})

const groupColor: Record<string, string> = {
  model: 'bg-blue-500/20 border-blue-500',
  seed: 'bg-green-500/20 border-green-500',
  snapshot: 'bg-purple-500/20 border-purple-500',
  source: 'bg-orange-500/20 border-orange-500',
  test: 'bg-yellow-500/20 border-yellow-500',
  group: 'bg-gray-700/40 border-gray-400',
  subtree: 'bg-gray-600/30 border-gray-300',
}

const getNodeColor = (node: LineageNode | ColumnNode): string => {
  if ((node as PositionedNode<LineageNode>).isGroup) return groupColor.group
  if ((node as PositionedNode<LineageNode>).isSubtree) return groupColor.subtree
  return groupColor[node.type] || 'bg-gray-700/40 border-gray-400'
}

const normalizeColumnId = (columnId: string) => columnId.replace(/\s+/g, '')

const buildPositionMap = <T extends LineageNode | ColumnNode>(nodes: T[], edges: LineageEdge[]): PositionedNode<T>[] => {
  if (nodes.length === 0) return []

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  nodes.forEach((node) => {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  })

  edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target])
  })

  const queue: string[] = []
  incoming.forEach((value, key) => {
    if (value === 0) queue.push(key)
  })
  if (queue.length === 0) queue.push(nodes[0].id)

  const levels = new Map<string, number>()
  while (queue.length) {
    const current = queue.shift() as string
    const currentLevel = levels.get(current) ?? 0
    for (const neighbor of outgoing.get(current) || []) {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, currentLevel + 1)
        queue.push(neighbor)
      }
    }
  }

  const levelBuckets: Record<number, string[]> = {}
  nodes.forEach((node, idx) => {
    const level = levels.get(node.id) ?? 0
    if (!levelBuckets[level]) levelBuckets[level] = []
    levelBuckets[level].push(node.id)
    if (!levels.has(node.id)) levels.set(node.id, level)
  })

  const positioned: PositionedNode<T>[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0
    const bucket = levelBuckets[level]
    const index = bucket.indexOf(node.id)
    const horizontalSpacing = Math.max(canvas.width / Math.max(Object.keys(levelBuckets).length, 1), 200)
    const verticalSpacing = Math.max(canvas.height / Math.max(bucket.length, 1), 120)
    const x = 80 + level * horizontalSpacing
    const y = 80 + index * verticalSpacing
    return { ...node, x, y }
  })

  return positioned
}

const buildGroupedGraph = <T extends LineageNode | ColumnNode>(
  graphNodes: T[],
  graphEdges: LineageEdge[],
  grouping: GroupingMode,
  groups: LineageGroup[],
  collapsedGroups: Set<string>,
  collapsedSubtrees: Record<string, Set<string>>,
): VisibleGraph<T> => {
  let nodes: (T & { isGroup?: boolean; isSubtree?: boolean })[] = [...graphNodes]
  let edges: LineageEdge[] = [...graphEdges]

  const filteredGroups = groups.filter((g) => grouping === 'none' ? false : g.type === grouping)

  filteredGroups.forEach((group) => {
    const groupId = `group:${group.id}`
    const memberSet = new Set(group.members)
    if (!collapsedGroups.has(groupId)) return
    nodes = nodes.filter((node) => !memberSet.has(node.id))
    const aggregated: any = {
      id: groupId,
      label: `${group.label} (${group.members.length})`,
      type: 'group',
      database: undefined,
      schema: undefined,
      tags: [],
      isGroup: true,
    }

    const nextEdges: LineageEdge[] = []
    edges.forEach((edge) => {
      const sourceIn = memberSet.has(edge.source)
      const targetIn = memberSet.has(edge.target)
      if (sourceIn && targetIn) return
      if (sourceIn && !targetIn) {
        nextEdges.push({ source: groupId, target: edge.target })
        return
      }
      if (!sourceIn && targetIn) {
        nextEdges.push({ source: edge.source, target: groupId })
        return
      }
      nextEdges.push(edge)
    })
    nodes.push(aggregated)
    edges = nextEdges
  })

  Object.entries(collapsedSubtrees).forEach(([rootId, members]) => {
    const memberSet = new Set(members)
    if (memberSet.size === 0) return
    nodes = nodes.filter((node) => !memberSet.has(node.id))
    const subtreeId = `subtree:${rootId}`
    const nextEdges: LineageEdge[] = []
    edges.forEach((edge) => {
      const sourceIn = memberSet.has(edge.source)
      const targetIn = memberSet.has(edge.target)
      if (sourceIn && targetIn) return
      if (edge.source === rootId && targetIn) {
        nextEdges.push({ source: rootId, target: subtreeId })
        return
      }
      if (sourceIn && edge.target === rootId) {
        nextEdges.push({ source: subtreeId, target: rootId })
        return
      }
      if (sourceIn && !targetIn) {
        nextEdges.push({ source: subtreeId, target: edge.target })
        return
      }
      if (!sourceIn && targetIn) {
        nextEdges.push({ source: edge.source, target: subtreeId })
        return
      }
      nextEdges.push(edge)
    })
    nodes.push({
      ...(nodes.find((n) => n.id === rootId) as T),
      id: subtreeId,
      label: `Collapsed from ${rootId}`,
      isSubtree: true,
      type: 'group',
    })
    edges = nextEdges
  })

  const positioned = buildPositionMap(nodes as T[], edges)
  return { nodes: positioned, edges }
}

function LineagePage() {
  const navigate = useNavigate()
  const [graph, setGraph] = useState<LineageGraph>({ nodes: [], edges: [], groups: [] })
  const [columnGraph, setColumnGraph] = useState<ColumnLineageGraph>({ nodes: [], edges: [] })
  const [groupMode, setGroupMode] = useState<GroupingMode>('none')
  const [viewMode, setViewMode] = useState<ViewMode>('model')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsedSubtrees, setCollapsedSubtrees] = useState<Record<string, Set<string>>>({})
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [impact, setImpact] = useState<ImpactResponse>(emptyImpact)
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null)
  const [config, setConfig] = useState<LineageConfig>({})
  const [maxDepth, setMaxDepth] = useState<number | undefined>(undefined)

  useEffect(() => {
    api
      .get<{ lineage?: LineageConfig }>('/config')
      .then((res) => {
        const lineage = res.data?.lineage || {}
        setConfig(lineage)
        if (lineage.default_grouping_mode) setGroupMode(lineage.default_grouping_mode)
        if (lineage.max_initial_depth) setMaxDepth(lineage.max_initial_depth)
        if (lineage.load_column_lineage_by_default) {
          fetchColumnGraph()
        }
      })
      .catch(() => undefined)
  }, [])

  const fetchGraph = (depth?: number) => {
    const query = depth ? `?max_depth=${depth}` : ''
    api
      .get<LineageGraph>(`/lineage/graph${query}`)
      .then((res) => setGraph({ groups: res.data.groups || [], nodes: res.data.nodes, edges: res.data.edges }))
      .catch(() => setGraph({ nodes: [], edges: [], groups: [] }))
  }

  const fetchColumnGraph = () => {
    api
      .get<ColumnLineageGraph>('/lineage/columns')
      .then((res) => setColumnGraph(res.data))
      .catch(() => setColumnGraph({ nodes: [], edges: [] }))
  }

  useEffect(() => {
    fetchGraph(config.max_initial_depth)
  }, [config.max_initial_depth])

  const highlightNodes = useMemo(() => {
    const activeImpact = impact || emptyImpact
    const set = new Set<string>()
    if (viewMode === 'model' && selectedNode) {
      set.add(selectedNode)
      activeImpact.upstream.forEach((n) => set.add(n))
      activeImpact.downstream.forEach((n) => set.add(n))
    }
    if (viewMode === 'column' && selectedColumn) {
      set.add(selectedColumn)
      activeImpact.upstream.forEach((n) => set.add(n))
      activeImpact.downstream.forEach((n) => set.add(n))
    }
    return set
  }, [impact, selectedColumn, selectedNode, viewMode])

  const activeGraph = viewMode === 'model' ? graph : columnGraph
  const groups = graph.groups || []

  const visibleGraph = useMemo(() => {
    return buildGroupedGraph(
      activeGraph.nodes as any,
      activeGraph.edges as any,
      groupMode,
      groups,
      collapsedGroups,
      collapsedSubtrees,
    )
  }, [activeGraph.edges, activeGraph.nodes, collapsedGroups, collapsedSubtrees, groupMode, groups])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const collapseSubtree = (rootId: string) => {
    setCollapsedSubtrees((prev) => {
      const next = { ...prev }
      if (next[rootId]) {
        delete next[rootId]
        return next
      }
      const members = new Set<string>()
      visibleGraph.edges.forEach((edge) => {
        if (edge.source === rootId) members.add(edge.target)
      })
      if (members.size > 0) next[rootId] = members
      return next
    })
  }

  const selectModelNode = (nodeId: string) => {
    setViewMode('model')
    setSelectedColumn(null)
    setSelectedNode(nodeId)
    api
      .get<ImpactResponse>(`/lineage/upstream/${encodeURIComponent(nodeId)}`)
      .then((res) => setImpact(normalizeImpact(res.data)))
      .catch(() => setImpact(emptyImpact))
    api.get<ModelDetail>(`/lineage/model/${encodeURIComponent(nodeId)}`).then((res) => setModelDetail(res.data))
  }

  const selectColumnNode = (columnId: string) => {
    const normalized = normalizeColumnId(columnId)
    const separatorIndex = normalized.indexOf('.')
    const modelId = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized
    const column = separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : ''
    setViewMode('column')
    setSelectedNode(null)
    setSelectedColumn(normalized)
    api
      .get<ImpactResponse>(`/lineage/upstream/${encodeURIComponent(modelId)}?column=${encodeURIComponent(column)}`)
      .then((res) => setImpact(normalizeImpact(res.data)))
      .catch(() => setImpact(emptyImpact))
  }

  const handleNodeClick = (node: PositionedNode<LineageNode> | PositionedNode<ColumnNode>) => {
    if (node.isGroup || node.isSubtree) {
      return
    }
    if (viewMode === 'model') {
      selectModelNode(node.id)
    } else {
      selectColumnNode(node.id)
    }
  }

  const visibleGroups = useMemo(() => groups.filter((g) => groupMode === 'none' ? true : g.type === groupMode), [groupMode, groups])

  const deselectColumnView = () => {
    setViewMode('model')
    setSelectedColumn(null)
    setImpact(emptyImpact)
  }

  const hasData = visibleGraph.nodes.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lineage</h1>
          <p className="text-sm text-gray-400">Navigate model and column lineage with grouping, collapse, and impact analysis.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupingMode)}
            className="bg-panel border border-gray-700 rounded px-3 py-2 text-sm"
          >
            <option value="none">No grouping</option>
            <option value="schema">Schema</option>
            <option value="resource_type">Resource type</option>
            <option value="tag">Tags</option>
          </select>
          <input
            type="number"
            min={1}
            value={maxDepth ?? ''}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : undefined
              setMaxDepth(value)
              fetchGraph(value)
            }}
            placeholder="Max depth"
            className="bg-panel border border-gray-700 rounded px-3 py-2 text-sm w-28"
          />
          <button
            onClick={() => {
              fetchGraph(maxDepth)
              if (config.load_column_lineage_by_default) fetchColumnGraph()
            }}
            className="bg-accent text-white px-4 py-2 rounded text-sm"
          >
            Refresh
          </button>
          {viewMode === 'column' && (
            <button onClick={deselectColumnView} className="bg-gray-700 text-white px-4 py-2 rounded text-sm border border-gray-500">
              Return to models
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 bg-panel border border-gray-800 rounded-lg p-4">
          {!hasData ? (
            <div className="text-gray-400">No lineage data available.</div>
          ) : (
            <div className="relative" style={{ width: canvas.width, height: canvas.height }}>
              <svg width={canvas.width} height={canvas.height} className="absolute inset-0">
                {visibleGraph.edges.map((edge) => {
                  const source = visibleGraph.nodes.find((n) => n.id === edge.source)
                  const target = visibleGraph.nodes.find((n) => n.id === edge.target)
                  if (!source || !target) return null
                  const isHighlighted = highlightNodes.has(edge.source) && highlightNodes.has(edge.target)
                  return (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={isHighlighted ? '#22d3ee' : '#374151'}
                      strokeWidth={isHighlighted ? 3 : 1.5}
                      markerEnd="url(#arrowhead)"
                      opacity={isHighlighted || highlightNodes.size === 0 ? 0.95 : 0.2}
                    />
                  )
                })}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
                  </marker>
                </defs>
              </svg>
              {visibleGraph.nodes.map((node) => {
                const color = getNodeColor(node)
                const emphasized = highlightNodes.size === 0 || highlightNodes.has(node.id)
                return (
                  <div
                    key={node.id}
                    className={`absolute rounded-lg border px-3 py-2 text-xs cursor-pointer shadow ${color} ${emphasized ? 'opacity-100' : 'opacity-25'}`}
                    style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)', minWidth: 120 }}
                    onClick={() => handleNodeClick(node)}
                  >
                    <div className="font-semibold text-white truncate" title={node.label}>{node.label}</div>
                    {node.schema && <div className="text-[10px] text-gray-300">{node.schema}</div>}
                    {node.type && <div className="text-[10px] uppercase text-gray-400">{node.type}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="col-span-3 space-y-4">
          <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Grouping</h3>
              <span className="text-[11px] text-gray-400">Mode: {groupMode}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {visibleGroups.map((group) => {
                const groupId = `group:${group.id}`
                const collapsed = collapsedGroups.has(groupId)
                return (
                  <div key={group.id} className="flex items-center justify-between text-sm text-gray-200">
                    <div>
                      <div className="font-medium">{group.label}</div>
                      <div className="text-[11px] text-gray-400">{group.members.length} nodes</div>
                    </div>
                    <button
                      onClick={() => toggleGroup(groupId)}
                      className="text-xs px-2 py-1 border border-gray-600 rounded"
                    >
                      {collapsed ? 'Expand' : 'Collapse'}
                    </button>
                  </div>
                )
              })}
              {visibleGroups.length === 0 && <div className="text-xs text-gray-400">No groups available for this mode.</div>}
            </div>
          </div>

          <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Selection</h3>
              {selectedNode && (
                <button
                  onClick={() => navigate(`/models/${selectedNode}`)}
                  className="text-xs text-accent underline"
                >
                  Open model
                </button>
              )}
            </div>
            {selectedNode && modelDetail && (
              <div className="space-y-2">
                <div className="text-gray-200 text-sm font-medium">{modelDetail.model_id}</div>
                <div className="text-[11px] text-gray-400">Parents: {modelDetail.parents.length} | Children: {modelDetail.children.length}</div>
                <div className="flex flex-wrap gap-1">
                  {(modelDetail.tags || []).map((tag) => (
                    <span key={tag} className="text-[10px] bg-gray-700 px-2 py-1 rounded-full text-gray-200">{tag}</span>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-gray-300 font-semibold">Columns</div>
                  <div className="max-h-32 overflow-auto space-y-1">
                    {Object.entries(modelDetail.columns || {}).map(([col, meta]) => {
                      const columnId = `${modelDetail.model_id}.${col}`
                      return (
                        <button
                          key={col}
                          onClick={() => selectColumnNode(columnId)}
                          className="w-full text-left text-[11px] px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
                        >
                          <div className="text-gray-100">{col}</div>
                          {meta.description && <div className="text-gray-400 truncate">{meta.description}</div>}
                        </button>
                      )
                    })}
                    {Object.keys(modelDetail.columns || {}).length === 0 && <div className="text-[11px] text-gray-500">No columns.</div>}
                  </div>
                </div>
                <button
                  onClick={() => collapseSubtree(selectedNode)}
                  className="text-xs px-3 py-1 bg-gray-700 border border-gray-600 rounded"
                >
                  Toggle collapse subtree
                </button>
              </div>
            )}
            {selectedColumn && (
              <div className="space-y-1 text-sm text-gray-200">
                <div className="font-semibold">{selectedColumn}</div>
                <div className="text-[11px] text-gray-400">Upstream: {impact.upstream.length} | Downstream: {impact.downstream.length}</div>
              </div>
            )}
            {!selectedNode && !selectedColumn && <div className="text-xs text-gray-400">Select a node to view details.</div>}
          </div>

          <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-semibold text-white">Impact</h3>
            {impact.upstream.length + impact.downstream.length === 0 ? (
              <div className="text-xs text-gray-400">No impact highlighted.</div>
            ) : (
              <div className="text-xs text-gray-200 space-y-2">
                <div>
                  <div className="font-semibold text-gray-300">Upstream</div>
                  <div className="flex flex-wrap gap-1">
                    {impact.upstream.map((item) => (
                      <span key={item} className="bg-gray-700 px-2 py-1 rounded text-[11px]">{item}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-300">Downstream</div>
                  <div className="flex flex-wrap gap-1">
                    {impact.downstream.map((item) => (
                      <span key={item} className="bg-gray-700 px-2 py-1 rounded text-[11px]">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LineagePage
