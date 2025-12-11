import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { ModelSummary } from '../types'

function DocsPage() {
  const [models, setModels] = useState<ModelSummary[]>([])

  useEffect(() => {
    api.get<ModelSummary[]>('/models').then((res) => setModels(res.data)).catch(() => setModels([]))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Docs</h1>
      <p className="text-gray-300 text-sm">A preview of how documentation will look. Click a model to view details.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {models.map((model) => (
          <Link key={model.unique_id} to={`/models/${model.unique_id}`} className="bg-panel border border-gray-800 rounded-lg p-4 hover:border-accent">
            <div className="text-lg font-semibold">{model.name}</div>
            <div className="text-gray-400 text-sm">{model.unique_id}</div>
            <div className="text-gray-500 text-xs mt-1">{model.resource_type}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default DocsPage
