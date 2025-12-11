import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ArtifactSummary, HealthResponse, ModelSummary, RunRecord } from '../types'
import { Card } from '../components/Card'

function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactSummary | null>(null)
  const [models, setModels] = useState<ModelSummary[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])

  useEffect(() => {
    api.get<HealthResponse>('/health').then((res) => setHealth(res.data)).catch(() => setHealth(null))
    api.get<ArtifactSummary>('/artifacts').then((res) => setArtifacts(res.data)).catch(() => setArtifacts(null))
    api.get<ModelSummary[]>('/models').then((res) => setModels(res.data)).catch(() => setModels([]))
    api.get<RunRecord[]>('/runs').then((res) => setRuns(res.data)).catch(() => setRuns([]))
  }, [])

  const lastRun = runs[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Health">{health ? `${health.status} (${health.version})` : 'Unavailable'}</Card>
        <Card title="Models">{models.length}</Card>
        <Card title="Latest Run">{lastRun?.status || 'N/A'}</Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-panel border border-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Artifacts</h3>
          <ul className="space-y-2 text-sm text-gray-200">
            <li>Manifest: {artifacts?.manifest ? 'Present' : 'Missing'}</li>
            <li>Run Results: {artifacts?.run_results ? 'Present' : 'Missing'}</li>
            <li>Catalog: {artifacts?.catalog ? 'Present' : 'Missing'}</li>
          </ul>
        </div>
        <div className="bg-panel border border-gray-800 rounded-lg p-4 col-span-2">
          <h3 className="text-lg font-semibold mb-3">Overview</h3>
          <p className="text-gray-300 text-sm">
            dbt-Workbench provides a lightweight, self-hosted way to inspect your dbt project. Load your artifacts, explore models,
            visualize lineage, and keep an eye on runs without vendor lock-in.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
