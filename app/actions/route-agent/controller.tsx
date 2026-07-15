import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { Auth } from 'remix/middleware/auth'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { sseEncoder, sseHeaders, pipeStream } from '../../utils/agent-sse.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { RouteAgentPage } from '../../ui/route-agent-page.tsx'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'

const MAX_MESSAGE_LENGTH = 5000

const routeAgentRateLimiter = createRateLimiter({ windowMs: 10_000, perKey: true, maxAttempts: 5 })

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
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
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
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
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
                await pipeStream(result.fullStream!, controller, context.request.signal, undefined, getTarget)
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
