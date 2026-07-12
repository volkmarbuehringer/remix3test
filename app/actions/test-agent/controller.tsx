import { createController } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import { SuperHeaders } from 'remix/headers'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { setStream, getStream } from '../../utils/stream-store.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { Layout } from '../../ui/layout.tsx'
import { TestAgentPage } from '../../ui/test-agent-page.tsx'
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { routes, frames } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import type { StoredStream } from '../../utils/stream-store.ts'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

const MAX_MESSAGE_LENGTH = 5000
const testRateLimiter = createRateLimiter({ windowMs: 10_000, perUser: false })
const requireApproval = (ctx: { toolName: string }) => ctx.toolName === 'mastra_workspace_read_file'
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
      let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
      if (isFrameRequest) {
        return renderAdminPage(context.render, 'testagent', <TestAgentPage error={error} />)
      }
      return context.render(
        <Layout title="Test Agent">
          <AdminLayout activeItem="testagent">
            <TestAgentPage error={error} />
          </AdminLayout>
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
              let p = chunk.payload as Record<string, unknown> | undefined

              let MAX_SSE_PAYLOAD = 65536

              function fwd(type: string, data: unknown) {
                let payload: string
                try {
                  payload = JSON.stringify(data)
                } catch {
                  payload = JSON.stringify({ _serializeError: true, type })
                }
                if (payload.length > MAX_SSE_PAYLOAD) {
                  payload = JSON.stringify({ _truncated: true, type })
                }
                controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${payload}\n\n`))
              }

              let type = chunk.type as string

              if (type === 'text-delta') {
                let text = String(p?.text ?? chunk.textDelta ?? '')
                if (text) fwd('message', { text })
              } else if (type === 'tool-call-approval') {
                fwd('suspension', {
                  runId: stored.runId,
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
                    runId: stored.runId,
                    toolCallId: p?.toolCallId,
                    question: sp.question,
                    options: sp.options ?? null,
                    selectionMode: sp.selectionMode ?? 'single_select',
                  })
                }
                closeOnce()
                reader?.cancel().catch(() => {})
                return
              } else if (type === 'finish') {
                fwd('complete', {})
              } else if (type === 'tool-call-input-streaming-start') {
                fwd(type, { toolCallId: p?.toolCallId, toolName: p?.toolName })
              } else if (type === 'tool-call-delta') {
                fwd(type, {
                  toolCallId: p?.toolCallId,
                  toolName: p?.toolName,
                  argsTextDelta: p?.argsTextDelta,
                })
              } else if (type === 'tool-call-input-streaming-end') {
                fwd(type, { toolCallId: p?.toolCallId })
              } else if (type === 'tool-call') {
                fwd(type, {
                  toolCallId: p?.toolCallId,
                  toolName: p?.toolName,
                  args: p?.args,
                })
              } else if (type === 'tool-result') {
                let result = p?.result as Record<string, unknown> | undefined
                let truncated = false
                let truncatedCount = 0
                if (
                  result &&
                  typeof result === 'object' &&
                  !Array.isArray(result) &&
                  Array.isArray(result.files) &&
                  result.files.length > 20
                ) {
                  truncatedCount = result.files.length
                  result = { ...result, files: result.files.slice(0, 20) }
                  truncated = true
                }
                fwd(type, {
                  toolCallId: p?.toolCallId,
                  toolName: p?.toolName,
                  result,
                  isError: p?.isError,
                  ...(truncated ? { _truncated: true, _truncatedCount: truncatedCount } : {}),
                })
              } else if (type === 'tool-error') {
                fwd(type, {
                  toolCallId: p?.toolCallId,
                  toolName: p?.toolName,
                  args: p?.args,
                  error: p?.error,
                })
              } else if (type === 'step-start') {
                fwd(type, { messageId: p?.messageId })
              } else if (type === 'step-finish') {
                let output = p?.output as Record<string, unknown> | undefined
                fwd(type, {
                  reason: (p?.stepResult as Record<string, unknown> | undefined)?.reason,
                  usage: output?.usage,
                })
              } else if (type === 'start') {
                fwd(type, { runId: stored.runId })
              } else if (type === 'error') {
                fwd(type, { error: p?.error })
              } else if (type === 'abort') {
                fwd(type, {})
              } else if (type === 'reasoning-start') {
                fwd(type, { id: p?.id })
              } else if (type === 'reasoning-delta') {
                fwd(type, { text: p?.text })
              } else if (type === 'reasoning-end') {
                fwd(type, {})
              } else if (type === 'text-start') {
                fwd(type, { id: p?.id })
              } else if (type === 'text-end') {
                fwd(type, {})
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

    async answer(context) {
      let rawIp = context.request.headers.get('X-Forwarded-For') || ''
      let ip = rawIp.split(',')[0].trim() || 'anon'
      if (!testRateLimiter.attempt(ip)) {
        return context.json({ error: 'Too many requests' }, { status: 429 })
      }

      let runId = context.formData.get('runId')?.toString()
      let answerRaw = context.formData.get('answer')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
      let selectionMode = context.formData.get('selectionMode')?.toString()

      if (!runId || !answerRaw) {
        return context.json({ error: 'Missing runId or answer' }, { status: 400 })
      }

      if (answerRaw.length > MAX_MESSAGE_LENGTH) {
        return context.json(
          { error: `Answer too long (max ${MAX_MESSAGE_LENGTH})` },
          { status: 400 },
        )
      }

      let resumeData: unknown = answerRaw
      if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
        try {
          resumeData = JSON.parse(answerRaw)
        } catch {
          /* keep as string */
        }
      }

      try {
        let agent = mastra.getAgent('testAgent')
        let output = await agent.resumeStream(resumeData, { runId, toolCallId })

        setStream(output.runId, {
          runId: output.runId,
          fullStream: output.fullStream as unknown as NodeReadableStream<unknown>,
          getFullOutput: () => output.getFullOutput(),
        })

        return context.json({ runId: output.runId, threadId: context.formData.get('threadId')?.toString() })
      } catch (err) {
        console.error('[testAgent] answer error:', err)
        return context.json({ error: 'Failed to resume agent' }, { status: 500 })
      }
    },
  },
})
