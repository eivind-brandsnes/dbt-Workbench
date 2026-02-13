interface StatusBadgeProps {
  status?: string
}

const statusColors: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35',
  succeeded: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35',
  error: 'bg-rose-500/16 text-rose-300 border border-rose-400/40',
  fail: 'bg-rose-500/16 text-rose-300 border border-rose-400/40',
  failure: 'bg-rose-500/16 text-rose-300 border border-rose-400/40',
  failed: 'bg-rose-500/16 text-rose-300 border border-rose-400/40',
  running: 'bg-sky-500/16 text-sky-300 border border-sky-400/38',
  in_progress: 'bg-sky-500/16 text-sky-300 border border-sky-400/38',
  queued: 'bg-cyan-500/14 text-cyan-300 border border-cyan-400/34',
  pending: 'bg-cyan-500/14 text-cyan-300 border border-cyan-400/34',
  cancelled: 'bg-slate-500/16 text-muted border border-border',
  skipped: 'bg-slate-500/16 text-muted border border-border',
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35',
  paused: 'bg-amber-500/16 text-amber-300 border border-amber-400/35',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || 'unknown'
  const color = statusColors[normalized] || 'bg-slate-500/16 text-muted border border-border'
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{status || 'unknown'}</span>
}
