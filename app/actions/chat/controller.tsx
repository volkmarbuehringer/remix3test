import { createController } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import { SuperHeaders } from 'remix/headers'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { mastra } from '../mastra/index.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { runWithUserId } from '../mastra/tools/customer-tools.ts'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import { setStream, getStream, verifyStreamOwner } from '../../utils/stream-store.ts'
import { Layout } from '../../ui/layout.tsx'
import { CustomerChatPage } from '../../ui/customer-chat-page.tsx'
import { createLogger } from '../../utils/logger.ts'
import {
  MAX_MESSAGE_LENGTH,
  validateMessage,
  sanitizeLog,
} from '../mastra/shared-agent.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import type { StoredStream } from '../../utils/stream-store.ts'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { tryGetCsrfToken } from '../../ui/csrf-token-input.tsx'

const CHAT_INDEX = routes.chat.index.href()

export const chatRateLimiter = createRateLimiter({ windowMs: 3000, perUser: true })
const chatLog = createLogger('[CustomerChat]')
const sseEncoder = new TextEncoder()

async function drainAndRebuild(stream: unknown): Promise<ReadableStream<unknown>> {
  let parts: unknown[] = []
  let reader = (stream as ReadableStream<unknown>).getReader()
  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new ReadableStream({
    start(controller) {
      for (let part of parts) {
        controller.enqueue(part)
      }
      controller.close()
    },
  })
}

function completedStream(text: string, userId: string | number, runId?: string): StoredStream {
  let id = runId || crypto.randomUUID()
  return {
    runId: id,
    userId,
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

export const customerChat = createController(routes.chat, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let threadId = context.url.searchParams.get('threadId') ?? undefined
      if (threadId && !validateThreadId(threadId)) threadId = undefined
      let error = context.url.searchParams.get('error') ?? undefined
      let chatMessages: ChatMessage[] = []
      if (threadId) {
        try {
          let agent = mastra.getAgent('customerAgent')
          chatMessages = await recallChatMessages(agent, threadId, String(user.id))
        } catch (error) {
          chatLog.error('recall failed for ' + sanitizeLog(threadId) + ': ' + sanitizeLog(String(error)))
        }
      }

      let csrfToken = tryGetCsrfToken()

      return context.render(
        <Layout>
          <CustomerChatPage
            messages={chatMessages}
            threadId={threadId}
            error={error}
            csrfToken={csrfToken}
          />
        </Layout>,
      )
    },

    async action(context) {
      let user = getCurrentUser()

      let validation = validateMessage(context.formData)
      if (!validation.ok) {
        let msg: string
        if (validation.error === 'too_long') {
          msg = `Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`
        } else if (validation.error === 'bad_thread_id') {
          msg = 'Ungültiges Thread-ID-Format.'
        } else {
          msg = 'Bitte gib eine Nachricht ein.'
        }
        return context.json({ error: msg }, { status: 400 })
      }

      let message = validation.message
      let threadId = validation.threadId

      if (!chatRateLimiter.attempt(user.id)) {
        return context.json(
          { error: 'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.' },
          { status: 429 },
        )
      }

      if (!threadId) {
        threadId = crypto.randomUUID()
      }

      try {
        let agent = mastra.getAgent('customerAgent')

        let output = await runWithUserId(user.id, () =>
          agent.stream(message, {
            memory: {
              thread: threadId,
              resource: String(user.id),
            },
          }),
        )

        let bufferedStream = await drainAndRebuild(output.fullStream)

        setStream(output.runId, {
          runId: output.runId,
          userId: user.id,
          fullStream: bufferedStream as unknown as NodeReadableStream<unknown>,
          getFullOutput: () => output.getFullOutput(),
        })

        return context.json({ runId: output.runId, threadId })
      } catch (error) {
        chatLog.error('action error:', sanitizeLog(String(error)))
        return context.json({ error: 'Fehler bei der Verarbeitung.' }, { status: 500 })
      }
    },

    async stream(context) {
      let auth = context.get(Auth) as { identity: { id: number } }
      let runId = context.params.runId
      if (!runId) {
        return new Response('Missing runId', { status: 400 })
      }

      let stored = getStream(runId)
      if (!stored) {
        return new Response('Stream not found', { status: 404 })
      }

      if (String(stored.userId) !== String(auth.identity.id)) {
        return new Response('Forbidden', { status: 403 })
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
                  if (type === 'message') {
                    let msg = JSON.parse(payload) as { text?: string }
                    let maxText = MAX_SSE_PAYLOAD - 50
                    msg.text = msg.text?.slice(0, maxText)
                    payload = JSON.stringify(msg)
                  } else {
                    payload = JSON.stringify({ _truncated: true, type })
                  }
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
                  | {
                      question?: string
                      options?: { label: string; description?: string }[]
                      selectionMode?: string
                    }
                  | undefined
                if (sp?.question) {
                  fwd('question', {
                    runId: stored.runId,
                    toolCallId: p?.toolCallId,
                    question: sp.question,
                    options: sp.options ?? null,
                    selectionMode: sp.selectionMode ?? 'single_select',
                  })
                } else {
                  fwd('complete', {})
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
                fwd(type, {
                  toolCallId: p?.toolCallId,
                  toolName: p?.toolName,
                  result,
                  isError: p?.isError,
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
                fwd('agent-error', { error: p?.error })
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
      let user = getCurrentUser()
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return context.json({ error: 'Missing runId' }, { status: 400 })
      }

      if (!verifyStreamOwner(runId, user.id)) {
        return context.json({ error: 'Forbidden' }, { status: 403 })
      }

      try {
        let agent = mastra.getAgent('customerAgent')
        let result = (await runWithUserId(user.id, () =>
          agent.approveToolCallGenerate({ runId, toolCallId }),
        )) as {
          text?: string
          finishReason?: string
          suspendPayload?: {
            toolCallId?: string
            toolName?: string
            args?: Record<string, unknown>
          }
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

        setStream(newRunId, completedStream(responseText, user.id, newRunId))
        return context.json({ runId: newRunId, text: responseText })
      } catch (error) {
        chatLog.error('approve failed:', sanitizeLog(String(error)))
        return context.json({ error: 'Fehler bei der Bestätigung.' }, { status: 500 })
      }
    },

    async decline(context) {
      let user = getCurrentUser()
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return context.json({ error: 'Missing runId' }, { status: 400 })
      }

      if (!verifyStreamOwner(runId, user.id)) {
        return context.json({ error: 'Forbidden' }, { status: 403 })
      }

      try {
        let agent = mastra.getAgent('customerAgent')
        let result = (await runWithUserId(user.id, () =>
          agent.declineToolCallGenerate({ runId, toolCallId }),
        )) as {
          text?: string
          finishReason?: string
          suspendPayload?: {
            toolCallId?: string
            toolName?: string
            args?: Record<string, unknown>
          }
          runId?: string
        }

        let newRunId = result.runId || crypto.randomUUID()
        let responseText = result.text || 'Der Vorgang wurde abgelehnt.'

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

        setStream(newRunId, completedStream(responseText, user.id, newRunId))
        return context.json({ runId: newRunId, text: responseText })
      } catch (error) {
        chatLog.error('decline failed:', sanitizeLog(String(error)))
        return context.json({ error: 'Fehler beim Ablehnen.' }, { status: 500 })
      }
    },

    async answer(context) {
      let user = getCurrentUser()

      let runId = context.formData.get('runId')?.toString()
      let answerRaw = context.formData.get('answer')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
      let selectionMode = context.formData.get('selectionMode')?.toString()

      if (!runId || !answerRaw) {
        return context.json({ error: 'Missing runId or answer' }, { status: 400 })
      }

      if (!verifyStreamOwner(runId, user.id)) {
        return context.json({ error: 'Forbidden' }, { status: 403 })
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
        let agent = mastra.getAgent('customerAgent')
        let output = await runWithUserId(user.id, () =>
          agent.resumeStream(resumeData, { runId, toolCallId }),
        )

        let bufferedStream = await drainAndRebuild(output.fullStream)

        setStream(output.runId, {
          runId: output.runId,
          userId: user.id,
          fullStream: bufferedStream as unknown as NodeReadableStream<unknown>,
          getFullOutput: () => output.getFullOutput(),
        })

        return context.json({
          runId: output.runId,
          threadId: context.formData.get('threadId')?.toString(),
        })
      } catch (err) {
        chatLog.error('answer error:', sanitizeLog(String(err)))
        return context.json({ error: 'Fehler bei der Antwortverarbeitung.' }, { status: 500 })
      }
    },
  },
})
