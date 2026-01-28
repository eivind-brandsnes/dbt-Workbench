import { graphlib, layout as dagreLayout } from '@dagrejs/dagre'
import { select } from 'd3-selection'
import { line, curveCatmullRom } from 'd3-shape'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import { Table } from '../components/Table'
import { RowLineageService } from '../services/rowLineageService'
import { SchedulerService } from '../services/schedulerService'
import {
  ColumnEvolutionChange,
  ColumnEvolutionEntry,
  ColumnEvolutionResponse,
  ColumnEvolutionStatus,
  ColumnLineageGraph,
  ColumnNode,
  EnvironmentConfig,
  ImpactResponse,
  LineageEdge,
  LineageGraph,
  LineageGroup,
  LineageNode,
  ModelDetail,
  RowLineageModelsResponse,
  RowLineagePreviewResponse,
  RowLineageStatus,
  RowLineageTraceResponse,
} from '../types'

type GroupingMode = 'none' | 'schema' | 'resource_type' | 'tag'
type ViewMode = 'model' | 'column' | 'row'
type ColumnLens = 'lineage' | 'evolution'

type GraphNode<T extends LineageNode | ColumnNode> = T & { isGroup?: boolean; isSubtree?: boolean }
type PositionedNode<T extends LineageNode | ColumnNode> = GraphNode<T> & { x: number; y: number }
type PositionedEdge = LineageEdge & { points: { x: number; y: number }[] }

type VisibleGraph<T extends LineageNode | ColumnNode> = {
  nodes: GraphNode<T>[]
  edges: LineageEdge[]
}

type LayoutResult<T extends LineageNode | ColumnNode> = {
  nodes: PositionedNode<T>[]
  edges: PositionedEdge[]
  size: { width: number; height: number }
}

type LineageConfig = {
  default_grouping_mode?: GroupingMode
  max_initial_depth?: number
  load_column_lineage_by_default?: boolean
  performance_mode?: string
}

const nodeSize = { width: 190, height: 84 }
const canvas = { width: 1200, height: 720 }
const emptyImpact: ImpactResponse = { upstream: [], downstream: [] }
const normalizeImpact = (value?: Partial<ImpactResponse>): ImpactResponse => ({
  upstream: value?.upstream ?? [],
  downstream: value?.downstream ?? [],
})

const groupColor: Record<string, { fill: string; stroke: string }> = {
  model: { fill: '#1f2937', stroke: '#3b82f6' },
  seed: { fill: '#1f2937', stroke: '#22c55e' },
  snapshot: { fill: '#1f2937', stroke: '#a855f7' },
  source: { fill: '#1f2937', stroke: '#fb923c' },
  test: { fill: '#1f2937', stroke: '#f59e0b' },
  row: { fill: '#1f2937', stroke: '#f472b6' },
  group: { fill: '#111827', stroke: '#9ca3af' },
  subtree: { fill: '#0f172a', stroke: '#e5e7eb' },
}

const getNodeColor = (node: LineageNode | ColumnNode): { fill: string; stroke: string } => {
  if ((node as GraphNode<LineageNode>).isGroup) return groupColor.group
  if ((node as GraphNode<LineageNode>).isSubtree) return groupColor.subtree
  return groupColor[node.type] || { fill: '#111827', stroke: '#9ca3af' }
}

const normalizeColumnId = (columnId: string) => columnId.replace(/\s+/g, '')
const rowTableColumnLimit = 6

const formatValueForCell = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const formatValueForDetails = (value: unknown): { text: string; complex: boolean } => {
  if (value === null) return { text: 'null', complex: false }
  if (value === undefined) return { text: '', complex: false }
  if (typeof value === 'object') {
    try {
      return { text: JSON.stringify(value, null, 2), complex: true }
    } catch {
      return { text: String(value), complex: false }
    }
  }
  return { text: String(value), complex: false }
}

const dedupeWarnings = (warnings: Array<string | undefined> | undefined): string[] => {
  if (!warnings) return []
  const seen = new Set<string>()
  const output: string[] = []
  warnings.forEach((warning) => {
    if (!warning || seen.has(warning)) return
    seen.add(warning)
    output.push(warning)
  })
  return output
}

const curvedLine = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveCatmullRom.alpha(0.6))

const buildLayout = <T extends LineageNode | ColumnNode>(visibleGraph: VisibleGraph<T>): LayoutResult<T> => {
  if (visibleGraph.nodes.length === 0) return { nodes: [], edges: [], size: canvas }

  const dag = new graphlib.Graph({ multigraph: true, compound: false })
  dag.setDefaultEdgeLabel(() => ({}))
  dag.setGraph({ rankdir: 'LR', ranksep: 140, nodesep: 80, marginx: 48, marginy: 48 })

  visibleGraph.nodes.forEach((node) => {
    dag.setNode(node.id, { width: nodeSize.width, height: nodeSize.height })
  })

  visibleGraph.edges.forEach((edge) => {
    dag.setEdge(edge.source, edge.target, {})
  })

  dagreLayout(dag)

  const graphLabel = dag.graph()
  const width = Math.max(graphLabel?.width || canvas.width, canvas.width)
  const height = Math.max(graphLabel?.height || canvas.height, canvas.height)

  const positionedNodes: PositionedNode<T>[] = visibleGraph.nodes.map((node) => {
    const dagNode = dag.node(node.id)
    return {
      ...node,
      x: dagNode?.x ?? nodeSize.width,
      y: dagNode?.y ?? nodeSize.height,
    }
  })

  const positionedEdges: PositionedEdge[] = visibleGraph.edges.map((edge) => {
    const dagEdge = dag.edge(edge.source, edge.target)
    return {
      ...edge,
      points: dagEdge?.points || [],
    }
  })

  return { nodes: positionedNodes, edges: positionedEdges, size: { width, height } }
}

const buildPathFromPoints = (points: { x: number; y: number }[]): string => {
  return curvedLine(points) || ''
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

  return { nodes, edges }
}

function LineagePage() {
  const navigate = useNavigate()
  const [graph, setGraph] = useState<LineageGraph>({ nodes: [], edges: [], groups: [] })
  const [columnGraph, setColumnGraph] = useState<ColumnLineageGraph>({ nodes: [], edges: [] })
  const [groupMode, setGroupMode] = useState<GroupingMode>('none')
  const [viewMode, setViewMode] = useState<ViewMode>('model')
  const [columnLens, setColumnLens] = useState<ColumnLens>('lineage')
  const [columnEvolution, setColumnEvolution] = useState<ColumnEvolutionResponse | null>(null)
  const [columnEvolutionLoading, setColumnEvolutionLoading] = useState(false)
  const [columnEvolutionError, setColumnEvolutionError] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsedSubtrees, setCollapsedSubtrees] = useState<Record<string, Set<string>>>({})
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [impact, setImpact] = useState<ImpactResponse>(emptyImpact)
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null)
  const [config, setConfig] = useState<LineageConfig>({})
  const [maxDepth, setMaxDepth] = useState<number | undefined>(undefined)

  // Row lineage state
  const [rowStatus, setRowStatus] = useState<RowLineageStatus | null>(null)
  const [rowStatusLoading, setRowStatusLoading] = useState(false)
  const [rowModels, setRowModels] = useState<RowLineageModelsResponse | null>(null)
  const [rowModelsLoading, setRowModelsLoading] = useState(false)
  const [rowEnvironmentId, setRowEnvironmentId] = useState<number | ''>('')
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>([])
  const [rowSelectedModelUniqueId, setRowSelectedModelUniqueId] = useState<string>('')
  const [rowPreview, setRowPreview] = useState<RowLineagePreviewResponse | null>(null)
  const [rowPreviewLoading, setRowPreviewLoading] = useState(false)
  const [rowTrace, setRowTrace] = useState<RowLineageTraceResponse | null>(null)
  const [rowTraceLoading, setRowTraceLoading] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowSelectedNodeId, setRowSelectedNodeId] = useState<string | null>(null)

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

  const fetchColumnEvolution = useCallback(() => {
    setColumnEvolutionLoading(true)
    setColumnEvolutionError(null)
    api
      .get<ColumnEvolutionResponse>('/lineage/columns/evolution')
      .then((res) => setColumnEvolution(res.data))
      .catch((err) => {
        const message = err?.response?.data?.message || err?.message || 'Failed to load column evolution.'
        setColumnEvolutionError(message)
        setColumnEvolution(null)
      })
      .finally(() => setColumnEvolutionLoading(false))
  }, [])

  const loadRowStatus = () => {
    setRowStatusLoading(true)
    RowLineageService.getStatus()
      .then((status) => setRowStatus(status))
      .catch(() =>
        setRowStatus({
          enabled: false,
          available: false,
          mapping_path: 'lineage/lineage.jsonl',
          mapping_mtime: null,
          mapping_count: 0,
          roots: [],
          models: [],
          warnings: ['Failed to load row lineage status.'],
        }),
      )
      .finally(() => setRowStatusLoading(false))
  }

  const loadRowModels = () => {
    setRowModelsLoading(true)
    RowLineageService.listModels()
      .then((payload) => setRowModels(payload))
      .catch(() => setRowModels({ roots: [], models: [], warnings: ['Failed to load row lineage models.'] }))
      .finally(() => setRowModelsLoading(false))
  }

  const loadEnvironments = () => {
    SchedulerService.listEnvironments()
      .then((envs) => {
        setEnvironments(envs)
        if (!rowEnvironmentId && envs.length > 0) {
          setRowEnvironmentId(envs[0].id)
        }
      })
      .catch(() => {
        const now = new Date().toISOString()
        const fallback = [
          {
            id: 0,
            name: 'default',
            description: 'Auto-created fallback environment',
            variables: {},
            created_at: now,
            updated_at: now,
          },
        ] as EnvironmentConfig[]
        setEnvironments(fallback)
        setRowEnvironmentId(0)
      })
  }

  useEffect(() => {
    fetchGraph(config.max_initial_depth)
  }, [config.max_initial_depth])

  useEffect(() => {
    if (viewMode !== 'column') return
    if (columnLens !== 'evolution') return
    fetchColumnEvolution()
  }, [columnLens, fetchColumnEvolution, viewMode])

  useEffect(() => {
    loadRowStatus()
    loadEnvironments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!rowStatus?.enabled) return
    loadRowModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowStatus?.enabled, rowStatus?.available])

  useEffect(() => {
    if (rowSelectedModelUniqueId || !rowModels) return
    const preferred =
      rowModels.roots.find((root) => root.model_unique_id)?.model_unique_id ||
      rowModels.models.find((model) => model.model_unique_id)?.model_unique_id ||
      ''
    if (preferred) {
      setRowSelectedModelUniqueId(preferred)
    }
  }, [rowModels, rowSelectedModelUniqueId])

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
    if (viewMode === 'row' && rowSelectedNodeId) {
      set.add(rowSelectedNodeId)
    }
    return set
  }, [impact, rowSelectedNodeId, selectedColumn, selectedNode, viewMode])

  const rowGraph = useMemo<LineageGraph>(() => {
    if (!rowTrace) return { nodes: [], edges: [], groups: [] }
    const nodes: LineageNode[] = rowTrace.graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: 'row',
      database: node.database ?? undefined,
      schema: node.schema ?? undefined,
      tags: [],
    }))
    const edges: LineageEdge[] = rowTrace.graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }))
    return { nodes, edges, groups: [] }
  }, [rowTrace])

  const columnGraphFiltered = useMemo<ColumnLineageGraph>(() => {
    if (columnGraph.nodes.length === 0) return columnGraph

    const normalize = (id: string) => normalizeColumnId(id)
    const connected = new Set<string>()
    columnGraph.edges.forEach((edge) => {
      connected.add(normalize(edge.source))
      connected.add(normalize(edge.target))
    })

    if (!selectedColumn) {
      const nodes = columnGraph.nodes.filter((node) => connected.has(normalize(node.id)))
      return { nodes, edges: columnGraph.edges }
    }

    const focus = new Set<string>([
      normalize(selectedColumn),
      ...impact.upstream.map((n) => normalize(n)),
      ...impact.downstream.map((n) => normalize(n)),
    ])
    const nodes = columnGraph.nodes.filter((node) => focus.has(normalize(node.id)))
    const edges = columnGraph.edges.filter(
      (edge) => focus.has(normalize(edge.source)) && focus.has(normalize(edge.target)),
    )
    return { nodes, edges }
  }, [columnGraph.edges, columnGraph.nodes, impact.downstream, impact.upstream, selectedColumn])

  const activeGraph = viewMode === 'model' ? graph : viewMode === 'column' ? columnGraphFiltered : rowGraph
  const groups = viewMode === 'model' ? graph.groups || [] : []

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

  const hasData = visibleGraph.nodes.length > 0
  const emptyGraphMessage =
    viewMode === 'row'
      ? rowTraceLoading
        ? 'Loading row lineage...'
        : rowPreview
          ? 'Select a row to view lineage.'
          : 'Load rows to start.'
      : viewMode === 'column'
        ? selectedColumn
          ? 'No column lineage available for this selection.'
          : 'Select a column to view lineage.'
        : 'No lineage data available.'

  const layout = useMemo(() => buildLayout(visibleGraph), [visibleGraph])

  const resolveNodeColor = (node: LineageNode | ColumnNode): { fill: string; stroke: string } => {
    const base = getNodeColor(node)
    if (viewMode !== 'column' || columnLens !== 'evolution') {
      return base
    }
    if ((node as GraphNode<LineageNode>).isGroup || (node as GraphNode<LineageNode>).isSubtree) {
      return base
    }
    const status = columnEvolutionStatus.get(normalizeColumnId(node.id))
    if (status === 'added') {
      return { fill: '#0f172a', stroke: '#22c55e' }
    }
    if (status === 'changed') {
      return { fill: '#0f172a', stroke: '#f59e0b' }
    }
    return base
  }

  const svgRef = useRef<SVGSVGElement | null>(null)
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!svgRef.current || !hasData) return
    const svg = select(svgRef.current)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => setTransform(event.transform))

    zoomBehaviorRef.current = zoomBehavior
    svg.call(zoomBehavior as any).on('dblclick.zoom', null)
    return () => {
      svg.on('.zoom', null)
    }
  }, [hasData])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === graphContainerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const adjustZoom = (scaleFactor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    select(svgRef.current).call(zoomBehaviorRef.current.scaleBy as any, scaleFactor)
  }

  const resetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    select(svgRef.current).call(zoomBehaviorRef.current.transform as any, zoomIdentity)
  }

  const toggleFullscreen = () => {
    const target = graphContainerRef.current
    if (!target) return
    if (document.fullscreenElement === target) {
      document.exitFullscreen?.().catch(() => undefined)
      return
    }
    target.requestFullscreen?.().catch(() => undefined)
  }

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
    } else if (viewMode === 'column') {
      selectColumnNode(node.id)
    } else {
      setRowSelectedNodeId(node.id)
    }
  }

  const visibleGroups = useMemo(
    () => groups.filter((g) => (groupMode === 'none' ? true : g.type === groupMode)),
    [groupMode, groups],
  )

  const deselectColumnView = () => {
    setViewMode('model')
    setSelectedColumn(null)
    setImpact(emptyImpact)
  }

  const rowMappingPath = rowStatus?.mapping_path || 'lineage/lineage.jsonl'
  const rowAvailable = Boolean(rowStatus?.enabled && rowStatus?.available)
  const rowTraceColumn = rowPreview?.trace_column || '_row_trace_id'
  const rowModelOptions = rowModels?.models || []
  const rowWarnings = useMemo(
    () =>
      dedupeWarnings([
        ...(rowStatus?.warnings || []),
        ...(rowModels?.warnings || []),
        ...(rowPreview?.warnings || []),
        ...(rowTrace?.warnings || []),
      ]),
    [rowModels?.warnings, rowPreview?.warnings, rowStatus?.warnings, rowTrace?.warnings],
  )

  const columnEvolutionStatus = useMemo(() => {
    const map = new Map<string, ColumnEvolutionStatus>()
    const statusMap = columnEvolution?.status_by_id || {}
    Object.entries(statusMap).forEach(([columnId, status]) => {
      map.set(normalizeColumnId(columnId), status)
    })
    return map
  }, [columnEvolution])

  const columnEvolutionAdded = columnEvolution?.added || []
  const columnEvolutionRemoved = columnEvolution?.removed || []
  const columnEvolutionChanged = columnEvolution?.changed || []

  const rowTableColumns = useMemo(() => {
    if (!rowPreview) return []
    const sourceColumns =
      rowPreview.columns && rowPreview.columns.length > 0
        ? rowPreview.columns
        : Object.keys(rowPreview.rows?.[0] || {})
    const nonTraceColumns = sourceColumns.filter((col) => col !== rowTraceColumn)
    const limited = nonTraceColumns.slice(0, rowTableColumnLimit)
    const finalColumns = [...limited]
    if (!finalColumns.includes(rowTraceColumn)) {
      finalColumns.push(rowTraceColumn)
    }
    return finalColumns.map((key) => ({
      key,
      header: key,
      render: (row: Record<string, any>) => formatValueForCell(row[key]),
    }))
  }, [rowPreview, rowTraceColumn])

  const selectedRowNode = useMemo(() => {
    if (!rowTrace) return null
    if (rowSelectedNodeId) {
      return rowTrace.graph.nodes.find((node) => node.id === rowSelectedNodeId) || null
    }
    const fallbackId = `row:${rowTrace.target.model_name}:${rowTrace.target.trace_id}`
    return rowTrace.graph.nodes.find((node) => node.id === fallbackId) || null
  }, [rowSelectedNodeId, rowTrace])

  const selectedRowEntries = selectedRowNode?.row ? Object.entries(selectedRowNode.row) : []
  const selectedRowModelName = selectedRowNode?.model_name || rowTrace?.target.model_name || ''
  const selectedRowTraceId = selectedRowNode?.trace_id || rowTrace?.target.trace_id || ''
  const selectedRowRelationName = selectedRowNode?.relation_name || rowTrace?.target.relation_name || ''

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'column' && columnGraph.nodes.length === 0) {
      fetchColumnGraph()
    }
    if (mode === 'column' && !selectedColumn && columnGraph.nodes.length > 0) {
      selectColumnNode(columnGraph.nodes[0].id)
    }
    if (mode === 'row' && !rowStatusLoading && !rowStatus) {
      loadRowStatus()
    }
  }

  const handleLoadRows = () => {
    if (!rowSelectedModelUniqueId) return
    setRowError(null)
    setRowPreviewLoading(true)
    setRowTrace(null)
    setRowSelectedNodeId(null)
    RowLineageService.previewModel({
      model_unique_id: rowSelectedModelUniqueId,
      environment_id: typeof rowEnvironmentId === 'number' ? rowEnvironmentId : undefined,
      limit: 100,
    })
      .then((payload) => setRowPreview(payload))
      .catch((err) => {
        const message = err?.response?.data?.message || err?.message || 'Failed to load rows.'
        setRowError(message)
      })
      .finally(() => setRowPreviewLoading(false))
  }

  const handleRowClick = (row: Record<string, any>) => {
    if (!rowSelectedModelUniqueId) return
    const traceId = row?.[rowTraceColumn]
    if (!traceId) {
      setRowError(`Row is missing ${rowTraceColumn}.`)
      return
    }
    setRowError(null)
    setRowTraceLoading(true)
    setRowTrace(null)
    const traceIdStr = String(traceId)
    const targetNodeId = rowPreview ? `row:${rowPreview.model_name}:${traceIdStr}` : null
    if (targetNodeId) {
      setRowSelectedNodeId(targetNodeId)
    }
    RowLineageService.getTrace(rowSelectedModelUniqueId, traceIdStr, {
      environment_id: typeof rowEnvironmentId === 'number' ? rowEnvironmentId : undefined,
    })
      .then((payload) => {
        setRowTrace(payload)
        const nextSelectedId = `row:${payload.target.model_name}:${payload.target.trace_id}`
        setRowSelectedNodeId(nextSelectedId)
      })
      .catch((err) => {
        const message = err?.response?.data?.message || err?.message || 'Failed to load row lineage.'
        setRowError(message)
      })
      .finally(() => setRowTraceLoading(false))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lineage</h1>
          <p className="text-sm text-gray-400">Navigate model, column, and row lineage with grouping, collapse, and impact analysis.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-end">
          <div className="flex rounded-md border border-gray-700 overflow-hidden shrink-0">
            {([
              { id: 'model', label: 'Model' },
              { id: 'column', label: 'Column' },
              { id: 'row', label: 'Row' },
            ] as Array<{ id: ViewMode; label: string }>).map((mode, idx) => {
              const active = viewMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => handleViewModeChange(mode.id)}
                  className={`px-3 py-2 text-sm ${
                    idx > 0 ? 'border-l border-gray-700' : ''
                  } ${active ? 'bg-accent text-white' : 'bg-panel text-gray-200 hover:bg-gray-800'}`}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>

          {viewMode !== 'row' && (
            <>
              {viewMode === 'column' && (
                <select
                  value={columnLens}
                  onChange={(e) => setColumnLens(e.target.value as ColumnLens)}
                  className="bg-panel border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="lineage">Column lineage</option>
                  <option value="evolution">Column evolution</option>
                </select>
              )}
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
            </>
          )}

          <button
            onClick={() => {
              if (viewMode === 'row') {
                const environmentId =
                  typeof rowEnvironmentId === 'number' && Number.isFinite(rowEnvironmentId)
                    ? rowEnvironmentId
                    : undefined
                RowLineageService.exportMappings({ environment_id: environmentId })
                  .then((payload) => {
                    setRowStatus(payload.status)
                    if (payload.status.enabled) {
                      loadRowModels()
                    }
                  })
                  .catch(() => {
                    loadRowStatus()
                    if (rowStatus?.enabled) {
                      loadRowModels()
                    }
                  })
                return
              }
              if (viewMode === 'column') {
                fetchColumnGraph()
                if (columnLens === 'evolution') {
                  fetchColumnEvolution()
                }
                return
              }
              fetchGraph(maxDepth)
              if (config.load_column_lineage_by_default) fetchColumnGraph()
            }}
            className="bg-accent text-white px-4 py-2 rounded text-sm"
          >
            {viewMode === 'row' ? 'Refresh row lineage' : 'Refresh'}
          </button>
          {viewMode === 'column' && (
            <button onClick={deselectColumnView} className="bg-gray-700 text-white px-4 py-2 rounded text-sm border border-gray-500">
              Return to models
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 bg-panel border border-gray-800 rounded-lg p-4 space-y-4">
          {viewMode === 'row' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label className="text-xs text-gray-400">Environment</label>
                  <select
                    value={rowEnvironmentId}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : ''
                      setRowEnvironmentId(value)
                    }}
                    className="bg-panel border border-gray-700 rounded px-3 py-2 text-sm"
                    data-testid="row-lineage-environment-select"
                  >
                    <option value="">Default</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                        {env.dbt_target_name ? ` (${env.dbt_target_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[260px]">
                  <label className="text-xs text-gray-400">Model</label>
                  <select
                    value={rowSelectedModelUniqueId}
                    onChange={(e) => {
                      setRowSelectedModelUniqueId(e.target.value)
                      setRowPreview(null)
                      setRowTrace(null)
                      setRowSelectedNodeId(null)
                      setRowError(null)
                    }}
                    className="bg-panel border border-gray-700 rounded px-3 py-2 text-sm"
                    disabled={rowStatusLoading || rowModelsLoading}
                    data-testid="row-lineage-model-select"
                  >
                    <option value="">Select a model</option>
                    {rowModelOptions
                      .filter((model) => model.model_unique_id)
                      .map((model) => {
                        const schemaSuffix = model.schema ? ` - ${model.schema}` : ''
                        const rootPrefix = model.is_root ? '[root] ' : ''
                        return (
                          <option key={model.model_unique_id || model.model_name} value={model.model_unique_id || ''}>
                            {rootPrefix}
                            {model.model_name}
                            {schemaSuffix}
                          </option>
                        )
                      })}
                  </select>
                </div>

                <button
                  onClick={handleLoadRows}
                  disabled={!rowAvailable || !rowSelectedModelUniqueId || rowPreviewLoading}
                  className="bg-accent text-white px-4 py-2 rounded text-sm disabled:opacity-60"
                  data-testid="row-lineage-load-rows"
                >
                  {rowPreviewLoading ? 'Loading rows...' : 'Load rows'}
                </button>
              </div>

              {rowStatusLoading && <div className="text-xs text-gray-400">Loading row lineage status...</div>}

              {rowStatus && !rowStatusLoading && !rowAvailable && (
                <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-4 text-sm text-amber-100 space-y-2">
                  <div className="font-semibold">Row lineage mappings not found at {rowMappingPath}</div>
                  <div className="text-amber-200">Enable dbt-rowlineage export:</div>
                  <pre className="text-xs bg-black/30 border border-amber-800/60 rounded p-3 overflow-auto">
{`vars:
  rowlineage_enabled: true
  rowlineage_export_format: jsonl
  rowlineage_export_path: target/lineage/lineage.jsonl`}
                  </pre>
                </div>
              )}

              {rowError && (
                <div className="rounded border border-red-800/70 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {rowError}
                </div>
              )}

              {rowAvailable && rowWarnings.length > 0 && (
                <div className="rounded border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 space-y-1">
                  {rowWarnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              )}

              {rowAvailable && rowPreview && !rowPreview.trace_column_present && (
                <div className="rounded border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  Table does not contain _row_trace_id; trace ids are computed heuristically for browsing.
                </div>
              )}

              {rowAvailable && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Sample Rows</h3>
                    {rowPreview && (
                      <div className="text-[11px] text-gray-400">
                        {rowPreview.relation_name}
                      </div>
                    )}
                  </div>
                  {rowPreview ? (
                    rowPreview.rows.length > 0 ? (
                      <Table columns={rowTableColumns} data={rowPreview.rows} onRowClick={handleRowClick} />
                    ) : (
                      <div className="text-xs text-gray-400">No rows returned for this model.</div>
                    )
                  ) : (
                    <div className="text-xs text-gray-400">Load rows to explore row-level lineage.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {(viewMode !== 'row' || rowAvailable) &&
            (!hasData ? (
              <div className="text-gray-400">{emptyGraphMessage}</div>
            ) : (
              <div
                ref={graphContainerRef}
                className={`relative rounded-lg overflow-hidden border border-gray-800/60 bg-gradient-to-br from-gray-950 via-slate-950 to-gray-900 ${
                  isFullscreen ? 'h-full w-full' : 'h-[720px]'
                }`}
              >
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900/80 px-2 py-1 text-[11px] text-gray-200 backdrop-blur">
                  <button
                    onClick={() => adjustZoom(1.2)}
                    className="rounded border border-gray-600 px-2 py-1 hover:bg-gray-800"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                  <button
                    onClick={() => adjustZoom(1 / 1.2)}
                    className="rounded border border-gray-600 px-2 py-1 hover:bg-gray-800"
                    aria-label="Zoom out"
                  >
                    -
                  </button>
                  <button
                    onClick={resetZoom}
                    className="rounded border border-gray-600 px-2 py-1 hover:bg-gray-800"
                  >
                    Reset
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="rounded border border-gray-600 px-2 py-1 hover:bg-gray-800"
                  >
                    {isFullscreen ? 'Exit full screen' : 'Full screen'}
                  </button>
                </div>
                <svg
                  ref={svgRef}
                  width="100%"
                  height={isFullscreen ? '100%' : canvas.height}
                  viewBox={`0 0 ${layout.size.width} ${layout.size.height}`}
                  className="w-full h-full text-gray-200 cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                >
                  <defs>
                    <marker
                      id="lineage-arrow"
                      markerWidth="12"
                      markerHeight="10"
                      refX="12"
                      refY="5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <polygon points="0 0, 12 5, 0 10" fill="#38bdf8" />
                    </marker>
                    <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0ea5e9" floodOpacity="0.12" />
                    </filter>
                    <pattern id="lineage-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1f2937" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect
                    width={layout.size.width}
                    height={layout.size.height}
                    fill="url(#lineage-grid)"
                    rx={16}
                    ry={16}
                    className="text-gray-800"
                  />
                  <g transform={transform.toString()}>
                    {layout.edges.map((edge) => {
                      const sourceHighlighted = highlightNodes.has(edge.source) && highlightNodes.has(edge.target)
                      const opacity = sourceHighlighted || highlightNodes.size === 0 ? 0.92 : 0.25
                      return (
                        <path
                          key={`${edge.source}-${edge.target}`}
                          d={buildPathFromPoints(edge.points)}
                          fill="none"
                          stroke={sourceHighlighted ? '#38bdf8' : '#475569'}
                          strokeWidth={sourceHighlighted ? 3 : 1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#lineage-arrow)"
                          opacity={opacity}
                        />
                      )
                    })}

                    {layout.nodes.map((node) => {
                      const { fill, stroke } = resolveNodeColor(node)
                      const emphasized = highlightNodes.size === 0 || highlightNodes.has(node.id)
                      const faded = emphasized ? 1 : 0.35
                      const isCollapsed = (node as PositionedNode<LineageNode>).isGroup || (node as PositionedNode<LineageNode>).isSubtree
                      const labelLines = String(node.label || '').split('\n')
                      const labelOffset = Math.max(0, labelLines.length - 1) * 16
                      const schemaY = 46 + labelOffset
                      const typeY = 62 + labelOffset
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x - nodeSize.width / 2}, ${node.y - nodeSize.height / 2})`}
                          onClick={() => handleNodeClick(node)}
                          data-node-id={node.id}
                          data-testid={`lineage-node-${node.id}`}
                          role="button"
                          className="cursor-pointer transition duration-150"
                          opacity={faded}
                        >
                          <rect
                            width={nodeSize.width}
                            height={nodeSize.height}
                            rx={12}
                            ry={12}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isCollapsed ? 1 : 1.75}
                            strokeDasharray={isCollapsed ? '6 4' : '0'}
                            filter="url(#node-shadow)"
                          />
                          <text x={16} y={26} className="text-sm font-semibold" fill="#e5e7eb">
                            {labelLines.map((lineText, idx) => (
                              <tspan key={`${node.id}-label-${idx}`} x={16} dy={idx === 0 ? 0 : 16}>
                                {lineText}
                              </tspan>
                            ))}
                          </text>
                          {node.schema && (
                            <text x={16} y={schemaY} className="text-[11px]" fill="#cbd5e1">
                              {node.schema}
                            </text>
                          )}
                          {node.type && (
                            <text x={16} y={typeY} className="text-[10px] uppercase" fill="#94a3b8">
                              {node.type}
                            </text>
                          )}
                          <title>{node.label}</title>
                        </g>
                      )
                    })}
                  </g>
                </svg>
              </div>
            ))}
        </div>

        <div className="col-span-3 space-y-4">
          {viewMode !== 'row' ? (
            <>
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

          {viewMode === 'column' && columnLens === 'evolution' && (
            <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Column Evolution</h3>
                {columnEvolution?.summary && (
                  <span className="text-[11px] text-gray-400">
                    {columnEvolution.summary.added + columnEvolution.summary.changed + columnEvolution.summary.removed} changes
                  </span>
                )}
              </div>
              {columnEvolutionLoading && <div className="text-xs text-gray-400">Loading column evolution...</div>}
              {columnEvolutionError && (
                <div className="text-xs text-red-300">{columnEvolutionError}</div>
              )}
              {!columnEvolutionLoading && !columnEvolutionError && columnEvolution && !columnEvolution.available && (
                <div className="text-xs text-gray-400">
                  {columnEvolution.message || 'Column evolution is not available yet.'}
                </div>
              )}
              {!columnEvolutionLoading && columnEvolution?.available && columnEvolution.summary && (
                <div className="space-y-2 text-xs text-gray-200">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded bg-emerald-900/40 border border-emerald-700/50 px-2 py-1 text-emerald-200">
                      Added {columnEvolution.summary.added}
                    </span>
                    <span className="rounded bg-amber-900/40 border border-amber-700/50 px-2 py-1 text-amber-200">
                      Changed {columnEvolution.summary.changed}
                    </span>
                    <span className="rounded bg-rose-900/40 border border-rose-700/50 px-2 py-1 text-rose-200">
                      Removed {columnEvolution.summary.removed}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Compared manifest v{columnEvolution.baseline_version?.version ?? '?'} → v{columnEvolution.current_version?.version ?? '?'}
                  </div>
                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {columnEvolutionAdded.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-emerald-300">Added</div>
                        {columnEvolutionAdded.map((entry: ColumnEvolutionEntry) => (
                          <button
                            key={entry.column_id}
                            onClick={() => selectColumnNode(entry.column_id)}
                            className="w-full text-left rounded bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 text-[11px] hover:bg-emerald-900/40"
                          >
                            {entry.model_name}:{entry.column}
                          </button>
                        ))}
                      </div>
                    )}
                    {columnEvolutionChanged.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-amber-300">Changed</div>
                        {columnEvolutionChanged.map((entry: ColumnEvolutionChange) => (
                          <button
                            key={entry.column_id}
                            onClick={() => selectColumnNode(entry.column_id)}
                            className="w-full text-left rounded bg-amber-950/40 border border-amber-800/40 px-2 py-1 text-[11px] hover:bg-amber-900/40"
                          >
                            <div>{entry.model_name}:{entry.column}</div>
                            {entry.changed_fields.length > 0 && (
                              <div className="text-[10px] text-amber-200">
                                {entry.changed_fields.join(', ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {columnEvolutionRemoved.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-rose-300">Removed</div>
                        {columnEvolutionRemoved.map((entry: ColumnEvolutionEntry) => (
                          <div
                            key={entry.column_id}
                            className="rounded bg-rose-950/40 border border-rose-800/40 px-2 py-1 text-[11px] text-rose-200"
                          >
                            {entry.model_name}:{entry.column}
                          </div>
                        ))}
                      </div>
                    )}
                    {columnEvolutionAdded.length === 0 &&
                      columnEvolutionChanged.length === 0 &&
                      columnEvolutionRemoved.length === 0 && (
                        <div className="text-xs text-gray-400">No column changes detected.</div>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}

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
            </>
          ) : (
            <>
              <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Row Details</h3>
                  {rowTrace?.truncated && <span className="text-[11px] text-amber-300">Truncated</span>}
                </div>
                {rowTraceLoading && <div className="text-xs text-gray-400">Loading row lineage...</div>}
                {!rowTraceLoading && !rowTrace && (
                  <div className="text-xs text-gray-400">Load rows and select one to inspect details.</div>
                )}
                {!rowTraceLoading && rowTrace && (
                  <div className="space-y-2">
                    <div className="text-gray-200 text-sm font-medium">{selectedRowModelName || rowTrace.target.model_name}</div>
                    <div className="text-[11px] text-gray-400 break-all">{selectedRowTraceId || rowTrace.target.trace_id}</div>
                    {selectedRowRelationName && <div className="text-[11px] text-gray-400">{selectedRowRelationName}</div>}
                    {rowTrace.truncated && (
                      <div className="text-[11px] text-amber-300">Traversal truncated at max hops.</div>
                    )}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-300 font-semibold">Row data</div>
                      {selectedRowEntries.length > 0 ? (
                        <div className="max-h-64 overflow-auto border border-gray-800 rounded">
                          <table className="w-full text-xs">
                            <tbody>
                              {selectedRowEntries.map(([key, value]) => {
                                const formatted = formatValueForDetails(value)
                                return (
                                  <tr key={key} className="border-b border-gray-800 last:border-b-0">
                                    <td className="px-2 py-1 text-gray-300 align-top w-1/3 break-all">{key}</td>
                                    <td className="px-2 py-1 text-gray-100 align-top">
                                      {formatted.complex ? (
                                        <pre className="whitespace-pre-wrap break-words">{formatted.text}</pre>
                                      ) : (
                                        formatted.text
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400">No row data available.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-panel border border-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Hop History</h3>
                  {rowTrace && <span className="text-[11px] text-gray-400">{rowTrace.hops.length} hops</span>}
                </div>
                {!rowTrace && <div className="text-xs text-gray-400">Select a row to view upstream hops.</div>}
                {rowTrace && rowTrace.hops.length === 0 && (
                  <div className="text-xs text-gray-400">No upstream hops found for this row.</div>
                )}
                {rowTrace && rowTrace.hops.length > 0 && (
                  <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                    {rowTrace.hops.map((hop, idx) => (
                      <div key={`${hop.source_model}-${hop.source_trace_id}-${idx}`} className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-1">
                        <div className="text-sm text-gray-100 font-medium">
                          {hop.source_model}
                          {' -> '}
                          {hop.target_model}
                        </div>
                        {hop.executed_at && <div className="text-[11px] text-gray-400">{hop.executed_at}</div>}
                        <details className="text-xs text-gray-200">
                          <summary className="cursor-pointer text-gray-300">Compiled SQL</summary>
                          <pre className="mt-1 rounded border border-gray-800 bg-black/40 p-2 whitespace-pre-wrap break-words">
                            {hop.compiled_sql || 'No compiled SQL available.'}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default LineagePage
