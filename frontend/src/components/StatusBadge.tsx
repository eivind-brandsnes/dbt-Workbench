interface StatusBadgeProps {
  status?: string
}

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border border-green-200',
  succeeded: 'bg-green-100 text-green-800 border border-green-200',
  error: 'bg-red-100 text-red-800 border border-red-200',
  fail: 'bg-red-100 text-red-800 border border-red-200',
  failure: 'bg-red-100 text-red-800 border border-red-200',
  failed: 'bg-red-100 text-red-800 border border-red-200',
  running: 'bg-blue-100 text-blue-800 border border-blue-200',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-200',
  queued: 'bg-blue-50 text-blue-700 border border-blue-200',
  pending: 'bg-blue-50 text-blue-700 border border-blue-200',
  cancelled: 'bg-gray-100 text-gray-800 border border-gray-200',
  skipped: 'bg-gray-100 text-gray-800 border border-gray-200',
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  paused: 'bg-amber-100 text-amber-800 border border-amber-200',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || 'unknown'
  const color = statusColors[normalized] || 'bg-gray-700 text-gray-200'
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{status || 'unknown'}</span>
}
