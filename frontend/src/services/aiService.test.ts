import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { AiService } from './aiService'

describe('AiService.streamChat', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('parses SSE events from stream endpoint', async () => {
    const encoder = new TextEncoder()
    const sse = [
      'event: meta\n',
      'data: {"conversation_id":1,"provider_mode":"direct","provider_name":"openai"}\n\n',
      'event: token\n',
      'data: {"text":"Hello"}\n\n',
      'event: done\n',
      'data: {"conversation_id":1,"message_id":2}\n\n',
    ].join('')

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse))
        controller.close()
      },
    })

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    ) as any

    const events: string[] = []
    await AiService.streamChat(
      { prompt: 'hello' },
      {
        onEvent: (event) => {
          events.push(event.event)
        },
      },
    )

    expect(events).toEqual(['meta', 'token', 'done'])
    expect(global.fetch).toHaveBeenCalled()
  })
})
