import React from 'react'
import { RunHistory as RunHistoryTable } from '../components/RunHistory'

function RunHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Run History</h1>
      </div>
      <RunHistoryTable />
    </div>
  )
}

export default RunHistoryPage
