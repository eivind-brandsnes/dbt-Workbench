import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { RunRecord } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import { Table } from '../components/Table'

function RunsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([])

  useEffect(() => {
    api.get<RunRecord[]>('/runs').then((res) => setRuns(res.data)).catch(() => setRuns([]))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      <Table
        columns={[
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'start_time', header: 'Start' },
          { key: 'end_time', header: 'End' },
          { key: 'duration', header: 'Duration (s)' },
          { key: 'model_unique_id', header: 'Model ID' },
        ]}
        data={runs}
      />
    </div>
  )
}

export default RunsPage
