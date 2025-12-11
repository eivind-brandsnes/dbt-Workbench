import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { LineageGraph } from '../types'

type PositionedNode = {
  id: string
  label: string
  x: number
  y: number
}

function LineagePage() {
  const [graph, setGraph] = useState<LineageGraph>({ nodes: [], edges: [] })
  const navigate = useNavigate()

  useEffect(() => {
    api.get<LineageGraph>('/lineage/graph').then((res) => setGraph(res.data)).catch(() => setGraph({ nodes: [], edges: [] }))
  }, [])

  const positionedNodes = useMemo(() => {
    const radius = 220
    const centerX = 400
    const centerY = 260
    const count = Math.max(graph.nodes.length, 1)
    return graph.nodes.map((node, index) => {
      const angle = (index / count) * 2 * Math.PI
      return {
        id: node.id,
        label: node.label,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    }) as PositionedNode[]
  }, [graph.nodes])

  const getNodeById = (id: string) => positionedNodes.find((n) => n.id === id)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lineage</h1>
      {graph.nodes.length === 0 ? (
        <div className="text-gray-300">No lineage data available.</div>
      ) : (
        <div className="bg-panel border border-gray-800 rounded-lg p-6 overflow-auto">
          <div className="relative" style={{ width: 800, height: 520 }}>
            <svg width={800} height={520} className="absolute inset-0">
              {graph.edges.map((edge) => {
                const source = getNodeById(edge.source)
                const target = getNodeById(edge.target)
                if (!source || !target) return null
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#374151"
                    strokeWidth={2}
                    markerEnd="url(#arrowhead)"
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
            {positionedNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => navigate(`/models/${node.id}`)}
                className="absolute rounded-full bg-accent/20 text-white border border-accent px-3 py-2 text-sm shadow"
                style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
              >
                {node.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LineagePage
