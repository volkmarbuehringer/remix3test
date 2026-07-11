import { createController } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
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

function completedStream(text: string, runId?: string): StoredStream {
  let id = runId || crypto.randomUUID()
  return {
    runId: id,
    textStream: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(text)
        controller.close()
      },
    }) as unknown as NodeReadableStream<string>,
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    }) as unknown as NodeReadableStream<unknown>,
    getFullOutput: async () => ({ text, finishReason: 'stop' }),
  }
}

export const testAgent = createController<typeof routes.testAgent, AppContext>(
  routes.testAgent,
  {
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
        let ip = context.request.headers.get('x-forwarded-for') || 'anon'
        if (!testRateLimiter.attempt(ip)) {
          return context.json({ error: 'Too many requests' }, { status: 429 })
        }

        let rawMessage = context.formData.get('message')?.toString() ?? ''
        if (rawMessage.length > MAX_MESSAGE_LENGTH) {
          return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH})` }, { status: 400 })
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
            requireToolApproval: (ctx) => ctx.toolName === 'read_test_file',
          })

          setStream(output.runId, {
            runId: output.runId,
            textStream: output.textStream as unknown as NodeReadableStream<string>,
            fullStream: output.fullStream as unknown as NodeReadableStream<unknown>,
            getFullOutput: () => output.getFullOutput(),
          })

          return context.json({ runId: output.runId, threadId })
        } catch (err) {
          return context.json({ error: String(err), threadId }, { status: 500 })
        }
      },

      async stream(context) {
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

        let reader: ReadableStreamDefaultReader<string> | undefined
        let sseStream = new ReadableStream({
          async start(controller) {
            reader = stored.textStream.getReader()
            request.signal.addEventListener('abort', () => {
              reader?.cancel().catch(() => {})
              try { controller.close() } catch { /* already closed */ }
            }, { once: true })
            try {
              try {
                while (true) {
                  let { done, value } = await reader.read()
                  if (done) break
                  if (request.signal.aborted) return
                  controller.enqueue(
                    new TextEncoder().encode(
                      `event: message\ndata: ${JSON.stringify({ text: value })}\n\n`,
                    ),
                  )
                }
              } finally {
                reader.releaseLock()
              }

              if (request.signal.aborted) return

              let output = await stored.getFullOutput()
              if (output.finishReason === 'suspended') {
                let sp = output.suspendPayload as
                  | { toolCallId?: string; toolName?: string; args?: Record<string, unknown> }
                  | undefined
                controller.enqueue(
                  new TextEncoder().encode(
                    `event: suspension\ndata: ${JSON.stringify({
                      runId: stored.runId,
                      toolCallId: sp?.toolCallId,
                      toolName: sp?.toolName,
                      args: sp?.args,
                    })}\n\n`,
                  ),
                )
              } else {
                controller.enqueue(
                  new TextEncoder().encode(`event: complete\ndata: {}\n\n`),
                )
              }
              controller.close()
            } catch (err) {
              try {
                controller.enqueue(
                  new TextEncoder().encode(
                    `event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`,
                  ),
                )
                controller.close()
              } catch {
                /* already closed */
              }
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
        })) as {
          text?: string
          finishReason?: string
          suspendPayload?: { toolCallId?: string }
          runId?: string
        }

        let newRunId = result.runId || crypto.randomUUID()
        let responseText = result.text || ''

        if (result.finishReason === 'suspended') {
          let sp = result.suspendPayload as { toolCallId?: string } | undefined
          setStream(newRunId, completedStream(responseText, newRunId))
          return context.json({
            runId: newRunId,
            requiresApproval: true,
            text: responseText,
            toolCallId: sp?.toolCallId,
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
        })) as {
          text?: string
          finishReason?: string
          suspendPayload?: { toolCallId?: string }
          runId?: string
        }

        let newRunId = result.runId || crypto.randomUUID()
        let responseText = result.text || ''

        if (result.finishReason === 'suspended') {
          let sp = result.suspendPayload as { toolCallId?: string } | undefined
          setStream(newRunId, completedStream(responseText, newRunId))
          return context.json({
            runId: newRunId,
            requiresApproval: true,
            text: responseText,
            toolCallId: sp?.toolCallId,
          })
        }

        setStream(newRunId, completedStream(responseText, newRunId))
        return context.json({ runId: newRunId, text: responseText })
      },
    },
  },
)
