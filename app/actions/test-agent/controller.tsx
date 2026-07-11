import { createController } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import { SuperHeaders } from 'remix/headers'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { setStream, getStream } from '../../utils/stream-store.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { Layout } from '../../ui/layout.tsx'
import { TestAgentPage } from '../../ui/test-agent-page.tsx'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import type { StoredStream } from '../../utils/stream-store.ts'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

const MAX_MESSAGE_LENGTH = 5000
const testRateLimiter = createRateLimiter({ windowMs: 10_000, perUser: false })
const requireApproval = (ctx: { toolName: string }) => ctx.toolName === 'readTestFile'
const sseEncoder = new TextEncoder()

function completedStream(text: string, runId?: string): StoredStream {
  let id = runId || crypto.randomUUID()
  return {
    runId: id,
    fullStream: new ReadableStream({
      start(controller) {
        if (text) {
          controller.enqueue({ type: 'text-delta', textDelta: text })
        }
        controller.enqueue({ type: 'finish', payload: {} })
        controller.close()
      },
    }) as unknown as NodeReadableStream<unknown>,
    getFullOutput: async () => ({ text, finishReason: 'stop' }),
  }
}

export const testAgent = createController<typeof routes.testAgent, AppContext>(routes.testAgent, {
  middleware: [requireAdmin()],

  actions: {
    async index(context) {
      let error = context.url.searchParams.get('error') ?? undefined
      return context.render(
        <Layout title="Test Agent">
          <TestAgentPage error={error} />
        </Layout>,
      )
    },

    async action(context) {
      let rawIp = context.request.headers.get('X-Forwarded-For') || ''
      let ip = rawIp.split(',')[0].trim() || 'anon'
      if (!testRateLimiter.attempt(ip)) {
        return context.json({ error: 'Too many requests' }, { status: 429 })
      }

      let rawMessage = context.formData.get('message')?.toString() ?? ''
      if (rawMessage.length > MAX_MESSAGE_LENGTH) {
        return context.json(
          { error: `Message too long (max ${MAX_MESSAGE_LENGTH})` },
          { status: 400 },
        )
      }
      let message = rawMessage.trim()
      if (!message) {
        return context.json({ error: 'Message is required' }, { status: 400 })
      }

      let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

      try {
        let agent = mastra.getAgent('testAgent')
        let output = await agent.stream(message, {
          memory: { thread: threadId, resource: 'test-user' },
          requireToolApproval: requireApproval,
        })
        setStream(output.runId, {
          runId: output.runId,
          fullStream: output.fullStream as unknown as NodeReadableStream<unknown>,
          getFullOutput: () => output.getFullOutput(),
        })

        return context.json({ runId: output.runId, threadId })
      } catch (err) {
        console.error('[testAgent] action error:', err)
        return context.json({ error: 'Failed to process request' }, { status: 500 })
      }
    },

    async stream(context) {
      let auth = context.get(Auth)
      if (!auth?.ok || auth.identity?.role !== 'admin') {
        return new Response('Unauthorized', { status: 401 })
      }

      let runId = context.params.runId
      if (!runId) {
        return new Response('Missing runId', { status: 400 })
      }

      let stored = getStream(runId)
      if (!stored) {
        return new Response('Stream not found', { status: 404 })
      }

      let request = context.request
      let headers = new SuperHeaders()
      headers.contentType = { mediaType: 'text/event-stream' }
      headers.cacheControl = { noCache: true, noStore: true }
      headers.connection = 'keep-alive'
      headers.set('X-Accel-Buffering', 'no')

      let reader: ReadableStreamDefaultReader<unknown> | undefined
      let controller: ReadableStreamDefaultController
      let closed = false
      function closeOnce() {
        if (closed) return
        closed = true
        try {
          controller?.close()
        } catch {
          /* already closed */
        }
      }

      let sseStream = new ReadableStream({
        async start(c) {
          controller = c
          reader = stored.fullStream.getReader()

          request.signal.addEventListener(
            'abort',
            () => {
              reader?.cancel().catch(() => {})
              closeOnce()
            },
            { once: true },
          )

          try {
            while (true) {
              let { done, value } = await reader.read()
              if (done) break
              if (request.signal.aborted) {
                closeOnce()
                return
              }

              if (!value || typeof value !== 'object') continue
              let chunk = value as Record<string, unknown>
              if (chunk.type === 'text-delta') {
                let text = String(
                  (chunk.payload as Record<string, unknown> | undefined)?.text ??
                    chunk.textDelta ??
                    '',
                )
                if (text) {
                  controller.enqueue(
                    sseEncoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`),
                  )
                }
              } else if (chunk.type === 'tool-call-approval') {
                let p = chunk.payload as Record<string, unknown> | undefined
                controller.enqueue(
                  sseEncoder.encode(
                    `event: suspension\ndata: ${JSON.stringify({
                      runId: stored.runId,
                      toolCallId: p?.toolCallId,
                      toolName: p?.toolName,
                      args: p?.args,
                    })}\n\n`,
                  ),
                )
              } else if (chunk.type === 'finish') {
                controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
              }
            }
            closeOnce()
          } catch (err) {
            try {
              controller.enqueue(
                sseEncoder.encode(
                  `event: stream-error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`,
                ),
              )
            } catch {
              /* controller already errored */
            }
            closeOnce()
          }
        },
        cancel() {
          reader?.cancel().catch(() => {})
        },
      })

      return new Response(sseStream, { headers })
    },

    async approve(context) {
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return context.json({ error: 'Missing runId' }, { status: 400 })
      }

      let agent = mastra.getAgent('testAgent')
      let result = (await agent.approveToolCallGenerate({
        runId,
        toolCallId,
        requireToolApproval: requireApproval,
      })) as {
        text?: string
        finishReason?: string
        suspendPayload?: { toolCallId?: string; toolName?: string; args?: Record<string, unknown> }
        runId?: string
      }

      let newRunId = result.runId || crypto.randomUUID()
      let responseText = result.text || ''

      if (result.finishReason === 'suspended') {
        let sp = result.suspendPayload
        return context.json({
          requiresApproval: true,
          text: responseText,
          runId: newRunId,
          toolCallId: sp?.toolCallId,
          toolName: sp?.toolName,
          args: sp?.args,
        })
      }

      setStream(newRunId, completedStream(responseText, newRunId))
      return context.json({ runId: newRunId, text: responseText })
    },

    async decline(context) {
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return context.json({ error: 'Missing runId' }, { status: 400 })
      }

      let agent = mastra.getAgent('testAgent')
      let result = (await agent.declineToolCallGenerate({
        runId,
        toolCallId,
        requireToolApproval: requireApproval,
      })) as {
        text?: string
        finishReason?: string
        suspendPayload?: { toolCallId?: string; toolName?: string; args?: Record<string, unknown> }
        runId?: string
      }

      let newRunId = result.runId || crypto.randomUUID()
      let responseText = result.text || 'The file read request was declined.'

      if (result.finishReason === 'suspended') {
        let sp = result.suspendPayload
        return context.json({
          requiresApproval: true,
          text: responseText,
          runId: newRunId,
          toolCallId: sp?.toolCallId,
          toolName: sp?.toolName,
          args: sp?.args,
        })
      }

      setStream(newRunId, completedStream(responseText, newRunId))
      return context.json({ runId: newRunId, text: responseText })
    },
  },
})
