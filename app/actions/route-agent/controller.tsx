import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { Auth } from 'remix/middleware/auth'
import { SuperHeaders } from 'remix/headers'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { RouteAgentPage } from '../../ui/route-agent-page.tsx'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'

const MAX_MESSAGE_LENGTH = 5000
const sseEncoder = new TextEncoder()

const routeAgentRateLimiter = createRateLimiter({ windowMs: 10_000, perKey: true, maxAttempts: 5 })

function sseHeaders() {
  let headers = new SuperHeaders()
  headers.contentType = { mediaType: 'text/event-stream' }
  headers.cacheControl = { noCache: true, noStore: true }
  headers.connection = 'keep-alive'
  headers.set('X-Accel-Buffering', 'no')
  return headers
}

function getTarget(path: string): string {
  let prefixes: [string, string][] = [
    ['/admin', 'admin-content'],
    ['/mastra', 'admin-content'],
    ['/verwaltung', 'admin-content'],
    ['/lists', 'lists-content'],
  ]
  let match: [string, string] | undefined
  for (let [prefix, target] of prefixes) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      if (!match || prefix.length > match[0].length) match = [prefix, target]
    }
  }
  return match?.[1] ?? 'lists-content'
}

function filterAndForward(
  chunk: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
  runId?: string,
): 'suspended' | undefined {
  let p = chunk.payload as Record<string, unknown> | undefined
  let type = chunk.type as string

  function fwd(type: string, data: unknown) {
    let payload: string
    try {
      payload = JSON.stringify(data)
    } catch {
      payload = JSON.stringify({ _serializeError: true, type })
    }
    if (payload.length > 65536) {
      if (type === 'message') {
        let msg = JSON.parse(payload) as { text?: string }
        msg.text = msg.text?.slice(0, 65536 - 50)
        payload = JSON.stringify(msg)
      } else {
        payload = JSON.stringify({ _truncated: true, type })
      }
    }
    controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${payload}\n\n`))
  }

  if (type === 'text-delta') {
    let text = String(p?.text ?? chunk.textDelta ?? '')
    if (text) fwd('message', { text })
  } else if (type === 'tool-call-approval') {
    fwd('suspension', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
    })
  } else if (type === 'tool-call-suspended') {
    let sp = p?.suspendPayload as
      | { question?: string; options?: { label: string; description?: string }[]; selectionMode?: string }
      | undefined
    if (sp?.question) {
      fwd('question', {
        runId,
        toolCallId: p?.toolCallId,
        question: sp.question,
        options: sp.options ?? null,
        selectionMode: sp.selectionMode ?? 'single_select',
      })
    }
    return 'suspended'
  } else if (type === 'finish') {
    fwd('complete', {})
  } else if (type === 'tool-result') {
    let result = p?.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      let prefill = result.data as Record<string, string> | undefined
      fwd('navigate', {
        href: result.path,
        target: getTarget(result.path),
        history: 'push',
        ...(prefill ? { prefill } : {}),
      })
    } else {
      fwd('tool-result', {
        toolCallId: p?.toolCallId,
        toolName: p?.toolName,
        result,
        isError: p?.isError,
      })
    }
  } else if (type === 'tool-error') {
    fwd('tool-error', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
      error: p?.error,
    })
  } else if (type === 'error') {
    fwd('agent-error', { error: p?.error })
  }
}

function pipeStream(
  fullStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
  runId?: string,
) {
  let reader: ReadableStreamDefaultReader<unknown>
  let closed = false

  function closeOnce() {
    if (closed) return
    closed = true
    try { controller.close() } catch { /* already closed */ }
  }

  ;(async () => {
    reader = fullStream.getReader()
    if (signal.aborted) {
      reader.cancel().catch(() => {})
      closeOnce()
      return
    }
    signal.addEventListener('abort', () => {
      reader?.cancel().catch(() => {})
      closeOnce()
    }, { once: true })

    try {
      while (true) {
        let { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) { closeOnce(); return }
        if (!value || typeof value !== 'object') continue

        let chunk = value as Record<string, unknown>
        let result = filterAndForward(chunk, controller, runId)
        if (result === 'suspended') {
          reader?.cancel().catch(() => {})
          closeOnce()
          return
        }
      }
      closeOnce()
    } catch (err) {
      try {
        controller.enqueue(
          sseEncoder.encode(`event: stream-error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`),
        )
      } catch { /* controller already errored */ }
      closeOnce()
    }
  })()

  return () => reader?.cancel().catch(() => {})
}

export const routeAgent = createController<typeof routes.routeAgent, AppContext>(
  routes.routeAgent,
  {
    middleware: [requireAdmin()],

    actions: {
      async index(context) {
        return context.render(
          <Layout title="Route Agent">
            <RouteAgentPage />
          </Layout>,
        )
      },

      async panel(context) {
        return context.render(
          <div mix={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.text.muted,
            fontSize: '1rem',
          })}>
            Ask the agent to navigate somewhere, e.g. "show me the lists"
          </div>
        )
      },

      async action(context) {
        let rawIp = context.request.headers.get('X-Forwarded-For') || ''
        let ip = rawIp.split(',')[0].trim() || 'anon'
        if (!routeAgentRateLimiter.attempt(ip)) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`),
            { status: 429, headers: sseHeaders() },
          )
        }

        let rawMessage = context.formData.get('message')?.toString() ?? ''
        if (rawMessage.length > MAX_MESSAGE_LENGTH) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: `Message too long (max ${MAX_MESSAGE_LENGTH})` })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }
        let message = rawMessage.trim()
        if (!message) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }

        let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent = mastra.getAgent('routeAgent')
              let output = await agent.stream(message, {
                memory: { thread: threadId, resource: 'route-user' },
              })
              controller.enqueue(
                sseEncoder.encode(`event: start\ndata: ${JSON.stringify({ runId: output.runId, threadId })}\n\n`),
              )
              pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
              )
            } catch (err) {
              console.error('[routeAgent] action error:', err)
              try {
                controller.enqueue(
                  sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to process request' })}\n\n`),
                )
              } catch { /* controller already errored */ }
              try { controller.close() } catch { /* already closed */ }
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async answer(context) {
        let rawIp = context.request.headers.get('X-Forwarded-For') || ''
        let ip = rawIp.split(',')[0].trim() || 'anon'
        if (!routeAgentRateLimiter.attempt(ip)) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`),
            { status: 429, headers: sseHeaders() },
          )
        }

        let runId = context.formData.get('runId')?.toString()
        let answerRaw = context.formData.get('answer')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let selectionMode = context.formData.get('selectionMode')?.toString()

        if (!runId || !answerRaw) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Missing runId or answer' })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (answerRaw.length > MAX_MESSAGE_LENGTH) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: `Answer too long (max ${MAX_MESSAGE_LENGTH})` })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }

        let resumeData: unknown = answerRaw
        if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
          try { resumeData = JSON.parse(answerRaw) } catch { /* keep as string */ }
        }

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent = mastra.getAgent('routeAgent')
              let output = await agent.resumeStream(resumeData, { runId, toolCallId })
              controller.enqueue(
                sseEncoder.encode(`event: start\ndata: ${JSON.stringify({ runId: output.runId, threadId: context.formData.get('threadId')?.toString() })}\n\n`),
              )
              pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
              )
            } catch (err) {
              console.error('[routeAgent] answer error:', err)
              try {
                controller.enqueue(
                  sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to resume agent' })}\n\n`),
                )
              } catch { /* controller already errored */ }
              try { controller.close() } catch { /* already closed */ }
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async toolDecision(context) {
        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let decision = context.formData.get('decision')?.toString()

        if (!runId) {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Missing runId' })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (decision !== 'approve' && decision !== 'decline') {
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'decision must be "approve" or "decline"' })}\n\n`),
            { status: 400, headers: sseHeaders() },
          )
        }

        try {
          let agent = mastra.getAgent('routeAgent')
          let fn = decision === 'approve' ? agent.approveToolCallGenerate : agent.declineToolCallGenerate
          let result = await fn({ runId, toolCallId }) as {
            text?: string
            finishReason?: string
            runId?: string
            suspendPayload?: Record<string, unknown>
            fullStream?: ReadableStream
          }

          if (result.finishReason === 'suspended') {
            let sp = result.suspendPayload as
              | { question?: string; options?: { label: string; description?: string }[]; selectionMode?: string; toolCallId?: string }
              | undefined
            if (sp?.question) {
              let body2 = new ReadableStream({
                start: (c) => {
                  c.enqueue(sseEncoder.encode(`event: question\ndata: ${JSON.stringify({
                    runId: result.runId || runId,
                    toolCallId: sp?.toolCallId,
                    question: sp.question,
                    options: sp.options ?? null,
                    selectionMode: sp.selectionMode ?? 'single_select',
                  })}\n\n`))
                  c.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
                  c.close()
                },
              })
              return new Response(body2, { headers: sseHeaders() })
            }
          }

          if (result.fullStream) {
            let body3 = new ReadableStream({
              start: async (controller) => {
                pipeStream(result.fullStream!, controller, context.request.signal)
              },
            })
            return new Response(body3, { headers: sseHeaders() })
          }

          let text = (result.text || (decision === 'approve' ? '' : 'The action was declined.')).trim()
          let body4 = new ReadableStream({
            start: (c) => {
              if (text) {
                c.enqueue(sseEncoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`))
              }
              c.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
              c.close()
            },
          })
          return new Response(body4, { headers: sseHeaders() })
        } catch (err) {
          console.error(`[routeAgent] toolDecision (${decision}) error:`, err)
          return new Response(
            sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to process tool decision' })}\n\n`),
            { status: 500, headers: sseHeaders() },
          )
        }
      },
    },
  },
)
