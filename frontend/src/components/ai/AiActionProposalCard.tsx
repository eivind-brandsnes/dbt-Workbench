import { useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { useAi } from '../../context/AiContext'
import { AiActionProposal } from '../../types/ai'

export function AiActionProposalCard({ proposal }: { proposal: AiActionProposal }) {
  const { isAuthEnabled, user } = useAuth()
  const { confirmProposal, rejectProposal } = useAi()
  const [isWorking, setIsWorking] = useState(false)

  const canExecute = !isAuthEnabled || user?.role === 'developer' || user?.role === 'admin'

  const handleConfirm = async () => {
    setIsWorking(true)
    try {
      await confirmProposal(proposal.proposal_id)
    } finally {
      setIsWorking(false)
    }
  }

  const handleReject = async () => {
    setIsWorking(true)
    try {
      await rejectProposal(proposal.proposal_id)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="rounded border border-border bg-surface p-3 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-semibold text-text">Action proposal: {proposal.proposal_type}</div>
        <span className="rounded bg-panel px-2 py-0.5 uppercase text-muted">{proposal.status}</span>
      </div>
      <pre className="max-h-40 overflow-auto rounded bg-panel p-2 text-[11px] text-text">
        {JSON.stringify(proposal.payload, null, 2)}
      </pre>
      {proposal.risk_flags.length > 0 && (
        <div className="mt-2 text-[11px] text-secondary">Risk flags: {proposal.risk_flags.join(', ')}</div>
      )}

      {proposal.status === 'pending' && (
        <div className="mt-2 flex gap-2">
          {canExecute && (
            <button
              type="button"
              className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60"
              onClick={handleConfirm}
              disabled={isWorking}
            >
              Confirm
            </button>
          )}
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-text disabled:opacity-60"
            onClick={handleReject}
            disabled={isWorking}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
