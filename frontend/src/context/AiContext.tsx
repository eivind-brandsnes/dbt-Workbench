import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from './AuthContext'
import { AiService } from '../services/aiService'
import {
  AiActionProposal,
  AiChatContext,
  AiConversation,
  AiMessage,
  AiProviderOverride,
  AiSettings,
  AiStreamEvent,
} from '../types/ai'

const defaultSettings: AiSettings = {
  enabled: true,
  default_mode: 'direct',
  default_direct_provider: 'openai',
  allow_session_provider_override: true,
  allow_data_context_results: true,
  allow_data_context_run_logs: true,
  ai_system_enabled: true,
  available_direct_providers: ['openai', 'anthropic', 'gemini'],
  has_direct_credentials: {},
  mcp_server_count: 0,
}

interface OpenPayload {
  prompt?: string
  context?: AiChatContext
}

interface AiContextValue {
  isPanelOpen: boolean
  setPanelOpen: (open: boolean) => void
  draftPrompt: string
  setDraftPrompt: (value: string) => void
  settings: AiSettings
  conversations: AiConversation[]
  activeConversationId: number | null
  setActiveConversationId: (id: number | null) => void
  messages: AiMessage[]
  proposals: AiActionProposal[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  sessionProviderOverride: AiProviderOverride | null
  setSessionProviderOverride: (value: AiProviderOverride | null) => void
  openPanel: (payload?: OpenPayload) => void
  refresh: () => Promise<void>
  loadMessages: (conversationId: number) => Promise<void>
  sendMessage: (prompt: string, context?: AiChatContext) => Promise<void>
  confirmProposal: (proposalId: string) => Promise<void>
  rejectProposal: (proposalId: string) => Promise<void>
}

const AiContext = createContext<AiContextValue | undefined>(undefined)

function storageKey(workspaceId?: number | null) {
  return `dbt_workbench_ai_override_${workspaceId ?? 'none'}`
}

export const AiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeWorkspace } = useAuth()
  const workspaceId = activeWorkspace?.id ?? null

  const [isPanelOpen, setPanelOpen] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState('')
  const [settings, setSettings] = useState<AiSettings>(defaultSettings)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [proposals, setProposals] = useState<AiActionProposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionProviderOverride, setSessionProviderOverrideState] = useState<AiProviderOverride | null>(null)

  const pendingContextRef = useRef<AiChatContext | undefined>(undefined)
  const assistantDraftRef = useRef<string>('')

  const setSessionProviderOverride = useCallback(
    (value: AiProviderOverride | null) => {
      setSessionProviderOverrideState(value)
      try {
        if (value) {
          window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(value))
        } else {
          window.localStorage.removeItem(storageKey(workspaceId))
        }
      } catch {
        // ignore storage failures
      }
    },
    [workspaceId],
  )

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [settingsData, conversationData] = await Promise.all([
        AiService.getSettings(),
        AiService.listConversations(),
      ])
      setSettings(settingsData)
      setConversations(conversationData)
      if (conversationData.length > 0) {
        setActiveConversationId((prev) => prev ?? conversationData[0].id)
      } else {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      const rows = await AiService.listMessages(conversationId)
      setMessages(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, workspaceId])

  useEffect(() => {
    if (!activeConversationId) return
    loadMessages(activeConversationId)
  }, [activeConversationId, loadMessages])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(workspaceId))
      if (!raw) {
        setSessionProviderOverrideState(null)
        return
      }
      setSessionProviderOverrideState(JSON.parse(raw))
    } catch {
      setSessionProviderOverrideState(null)
    }
  }, [workspaceId])

  const openPanel = useCallback((payload?: OpenPayload) => {
    setPanelOpen(true)
    if (payload?.prompt) {
      setDraftPrompt(payload.prompt)
    }
    if (payload?.context) {
      pendingContextRef.current = payload.context
    }
  }, [])

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<OpenPayload>
      openPanel(custom.detail || {})
    }
    window.addEventListener('ai-open', listener)
    return () => window.removeEventListener('ai-open', listener)
  }, [openPanel])

  const sendMessage = useCallback(
    async (prompt: string, context?: AiChatContext) => {
      const trimmed = prompt.trim()
      if (!trimmed) return

      setError(null)
      setIsStreaming(true)
      assistantDraftRef.current = ''

      let conversationId = activeConversationId
      let localConversations = conversations
      if (!conversationId) {
        const created = await AiService.createConversation(trimmed.slice(0, 80))
        conversationId = created.id
        localConversations = [created, ...localConversations]
        setConversations(localConversations)
        setActiveConversationId(created.id)
      }

      const nowIso = new Date().toISOString()
      setMessages((prev) => [
        ...prev,
        {
          id: -Date.now(),
          workspace_id: workspaceId || 0,
          conversation_id: conversationId,
          role: 'user',
          content: trimmed,
          message_metadata: {},
          created_at: nowIso,
        },
        {
          id: -(Date.now() + 1),
          workspace_id: workspaceId || 0,
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          message_metadata: {},
          created_at: nowIso,
        },
      ])

      const resolvedContext = context || pendingContextRef.current
      pendingContextRef.current = undefined

      try {
        await AiService.streamChat(
          {
            prompt: trimmed,
            conversation_id: conversationId,
            context: resolvedContext,
            provider_override: sessionProviderOverride || undefined,
          },
          {
            onEvent: (event: AiStreamEvent) => {
              if (event.event === 'token') {
                const piece = event.data?.text || ''
                assistantDraftRef.current += piece
                setMessages((prev) => {
                  const next = [...prev]
                  const idx = [...next].reverse().findIndex((m) => m.role === 'assistant')
                  if (idx >= 0) {
                    const realIndex = next.length - 1 - idx
                    next[realIndex] = {
                      ...next[realIndex],
                      content: assistantDraftRef.current,
                    }
                  }
                  return next
                })
              } else if (event.event === 'proposal') {
                setProposals((prev) => [
                  {
                    proposal_id: event.data.proposal_id,
                    proposal_type: event.data.proposal_type,
                    status: 'pending',
                    payload: event.data.payload || {},
                    risk_flags: event.data.risk_flags || [],
                    result_payload: {},
                    expires_at: event.data.expires_at,
                  },
                  ...prev,
                ])
              } else if (event.event === 'error') {
                setError(event.data?.message || 'AI stream failed')
              }
            },
          },
        )

        await Promise.all([
          refresh(),
          conversationId ? loadMessages(conversationId) : Promise.resolve(),
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to stream AI response')
      } finally {
        setIsStreaming(false)
      }
    },
    [
      activeConversationId,
      conversations,
      loadMessages,
      refresh,
      sessionProviderOverride,
      workspaceId,
    ],
  )

  const confirmProposal = useCallback(async (proposalId: string) => {
    await AiService.confirmProposal(proposalId)
    setProposals((prev) => prev.map((p) => (p.proposal_id === proposalId ? { ...p, status: 'executed' } : p)))
  }, [])

  const rejectProposal = useCallback(async (proposalId: string) => {
    await AiService.rejectProposal(proposalId)
    setProposals((prev) => prev.map((p) => (p.proposal_id === proposalId ? { ...p, status: 'rejected' } : p)))
  }, [])

  const value = useMemo<AiContextValue>(
    () => ({
      isPanelOpen,
      setPanelOpen,
      draftPrompt,
      setDraftPrompt,
      settings,
      conversations,
      activeConversationId,
      setActiveConversationId,
      messages,
      proposals,
      isLoading,
      isStreaming,
      error,
      sessionProviderOverride,
      setSessionProviderOverride,
      openPanel,
      refresh,
      loadMessages,
      sendMessage,
      confirmProposal,
      rejectProposal,
    }),
    [
      activeConversationId,
      confirmProposal,
      conversations,
      draftPrompt,
      error,
      isLoading,
      isPanelOpen,
      isStreaming,
      loadMessages,
      messages,
      openPanel,
      proposals,
      refresh,
      rejectProposal,
      sendMessage,
      sessionProviderOverride,
      setSessionProviderOverride,
      settings,
    ],
  )

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}

export function useAi() {
  const ctx = useContext(AiContext)
  if (!ctx) {
    throw new Error('useAi must be used within AiProvider')
  }
  return ctx
}
