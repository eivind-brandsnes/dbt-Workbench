import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ArtifactSummary } from '../types'

function SettingsPage() {
  const [artifacts, setArtifacts] = useState<ArtifactSummary | null>(null)

  useEffect(() => {
    api.get<ArtifactSummary>('/artifacts').then((res) => setArtifacts(res.data)).catch(() => setArtifacts(null))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="bg-panel border border-gray-800 rounded-lg p-4 space-y-2">
        <div className="text-sm text-gray-300">API Base URL: {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}</div>
        <div className="text-sm text-gray-300">Artifacts path: {artifacts ? 'Configured' : 'Unknown'}</div>
        {artifacts && (
          <ul className="text-sm text-gray-400 list-disc list-inside">
            <li>Manifest: {artifacts.manifest ? 'Present' : 'Missing'}</li>
            <li>Run results: {artifacts.run_results ? 'Present' : 'Missing'}</li>
            <li>Catalog: {artifacts.catalog ? 'Present' : 'Missing'}</li>
          </ul>
        )}
        <p className="text-xs text-gray-500">Future versions will support multiple environments and artifact locations.</p>
      </div>
    </div>
  )
}

export default SettingsPage
