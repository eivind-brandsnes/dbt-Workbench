import { AiComposer } from './AiComposer'
import { AiProviderSwitcher } from './AiProviderSwitcher'
import { AiActionProposalCard } from './AiActionProposalCard'
import { AiToolTraceView } from './AiToolTraceView'
import { useAi } from '../../context/AiContext'

export function AiAssistantPanel() {
  const {
    isPanelOpen,
    setPanelOpen,
    conversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    proposals,
    isLoading,
    isStreaming,
    error,
  } = useAi()

  return (
    <>
      {isPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setPanelOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-[540px] transform border-l border-border bg-bg shadow-xl transition-transform duration-200 ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-text">AI Copilot</h2>
              <p className="text-xs text-muted">Workspace-aware assistant with action confirmation flow.</p>
            </div>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs text-text"
              onClick={() => setPanelOpen(false)}
            >
              Close
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)]">
            <div className="border-r border-border bg-surface p-2">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">Conversations</div>
              <div className="max-h-[40vh] space-y-1 overflow-auto">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded px-2 py-1 text-left text-xs ${
                      activeConversationId === conversation.id ? 'bg-primary text-primary-foreground' : 'bg-panel text-text'
                    }`}
                  >
                    <div className="truncate font-medium">{conversation.title}</div>
                  </button>
                ))}
                {conversations.length === 0 && <div className="text-xs text-muted">No conversations yet</div>}
              </div>

              <div className="mt-3">
                <AiProviderSwitcher />
              </div>
            </div>

            <div className="flex min-h-0 flex-col p-3">
              <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded border border-border bg-surface p-2">
                {isLoading && <div className="text-xs text-muted">Loading AI context…</div>}
                {error && <div className="rounded border border-secondary/30 bg-secondary/10 p-2 text-xs text-secondary">{error}</div>}

                {messages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <div className={`rounded px-2 py-1 text-sm ${message.role === 'user' ? 'bg-panel text-text' : 'bg-primary/10 text-text'}`}>
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">{message.role}</div>
                      <div className="whitespace-pre-wrap">{message.content || (isStreaming && message.role === 'assistant' ? '…' : '')}</div>
                    </div>
                    <AiToolTraceView message={message} />
                  </div>
                ))}

                {proposals.map((proposal) => (
                  <AiActionProposalCard key={proposal.proposal_id} proposal={proposal} />
                ))}
              </div>

              <AiComposer />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
