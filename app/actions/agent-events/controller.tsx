import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { requireAdmin } from '../../middleware/admin.ts'
import { sseHeaders, sseErrorResponse, sseEvent, safeClose } from '../../utils/agent-sse.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { AgentEventsPage } from '../../ui/agent-events-page.tsx'
import { routes } from '../../routes.ts'
import { EventBus, type BaseEvent, MAX_MESSAGE_LENGTH } from './event-bus.ts'
import { registerHandlers } from './register.ts'

const CONFIRM_TTL = 5 * 60 * 1000

const pendingConfirmMap = new Map<string, { message: string; expiresAt: number }>()

let confirmRunIdCounter = 0
function nextConfirmRunId(): string {
  confirmRunIdCounter++
  return `agent-events-${Date.now()}-${confirmRunIdCounter}`
}

function createPipeline(message: string, signal?: AbortSignal): ReadableStream {
  return new ReadableStream({
    start: async (controller) => {
      let closed = false
      function closeOnce() {
        if (closed) return
        closed = true
        safeClose(controller)
      }

      let abortListener: (() => void) | undefined
      if (signal) {
        abortListener = () => closeOnce()
        signal.addEventListener('abort', abortListener, { once: true })
      }

      try {
        let bus = new EventBus()
        registerHandlers(bus)

        let initialEvent: BaseEvent = { type: 'request.received', message }

        for await (let event of bus.run(initialEvent)) {
          if (signal?.aborted) break

          switch (event.type) {
            case 'request.validated':
              controller.enqueue(sseEvent('status', { text: '✓ Input validated' }))
              break

            case 'request.invalid':
              controller.enqueue(sseEvent('agent-error', { error: event.error }))
              closeOnce()
              return

            case 'intent.classified':
              controller.enqueue(sseEvent('status', { text: `✓ Intent resolved: ${event.intent}` }))
              break

            case 'intent.unclear':
              controller.enqueue(sseEvent('message', { text: event.text }))
              controller.enqueue(sseEvent('complete', {}))
              closeOnce()
              return

            case 'entities.resolved':
              controller.enqueue(sseEvent('status', { text: `✓ Entities resolved` }))
              break

            case 'entities.notfound':
              controller.enqueue(sseEvent('message', { text: event.error }))
              controller.enqueue(sseEvent('complete', {}))
              closeOnce()
              return

            case 'action.running':
              controller.enqueue(sseEvent('status', { text: `▶ ${event.summary}` }))
              break

            case 'navigate':
              controller.enqueue(
                sseEvent('navigate', {
                  href: event.href,
                  target: event.target,
                  history: 'push',
                }),
              )
              break

            case 'message':
              controller.enqueue(sseEvent('message', { text: event.text }))
              controller.enqueue(sseEvent('complete', {}))
              closeOnce()
              return

            case 'confirm.required': {
              let runId = nextConfirmRunId()
              pendingConfirmMap.set(runId, { message, expiresAt: Date.now() + CONFIRM_TTL })
              controller.enqueue(
                sseEvent('confirm-required', {
                  runId,
                  question: event.question,
                  actionType: event.actionType,
                  payload: event.payload,
                }),
              )
              setTimeout(closeOnce, 30000)
              return
            }

            case 'confirm.resolved':
              break

            case 'action.completed':
              if (event.success) {
                controller.enqueue(sseEvent('status', { text: '✓ Action completed' }))
              } else {
                controller.enqueue(
                  sseEvent('agent-error', { error: String(event.result.error || 'Action failed') }),
                )
              }
              break

            case 'request.completed':
              controller.enqueue(sseEvent('complete', {}))
              closeOnce()
              return

            case 'request.failed':
              controller.enqueue(sseEvent('agent-error', { error: event.error }))
              closeOnce()
              return
          }
        }

        controller.enqueue(sseEvent('complete', {}))
        closeOnce()
      } catch (err) {
        console.error('[agentEvents] pipeline error:', err)
        try {
          controller.enqueue(sseEvent('agent-error', { error: String(err) }))
        } catch {
          /* already errored */
        }
        closeOnce()
      } finally {
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener)
        }
      }
    },
  })
}

export const agentEvents = createController(routes.agentEvents, {
  middleware: [requireAdmin()],

  actions: {
    async index(context) {
      return context.render(
        <Layout title="Agent-Events">
          <AgentEventsPage />
        </Layout>,
      )
    },

    async panel(context) {
      return context.render(
        <div
          mix={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.text.muted,
            fontSize: '1rem',
          })}
        >
          Event pipeline ready.
        </div>,
      )
    },

    async action(context) {
      let rawMessage = context.formData.get('message')?.toString() ?? ''
      if (rawMessage.length > MAX_MESSAGE_LENGTH) {
        return sseErrorResponse(`Message too long (max ${MAX_MESSAGE_LENGTH})`, 400)
      }
      let message = rawMessage.trim()
      if (!message) {
        return sseErrorResponse('Message is required', 400)
      }

      let body = createPipeline(message, context.request.signal)
      return new Response(body, { headers: sseHeaders() })
    },

    async resume(context) {
      let runId = context.formData.get('runId')?.toString()
      let confirmed = context.formData.get('confirmed')?.toString() === 'true'

      if (!runId) {
        return sseErrorResponse('Missing runId', 400)
      }

      let state = pendingConfirmMap.get(runId)
      if (!state || state.expiresAt < Date.now()) {
        pendingConfirmMap.delete(runId)
        return sseErrorResponse('Invalid or expired runId', 400)
      }
      pendingConfirmMap.delete(runId)

      let body = new ReadableStream({
        start: async (controller) => {
          try {
            let bus = new EventBus()
            registerHandlers(bus)

            let initialEvent: BaseEvent = {
              type: 'confirm.resolved',
              confirmed,
              payload: { message: state.message },
            }

            for await (let event of bus.run(initialEvent)) {
              switch (event.type) {
                case 'confirm.resolved':
                  break

                case 'action.completed':
                  if (event.success) {
                    controller.enqueue(sseEvent('status', { text: '✓ Action completed' }))
                  } else {
                    controller.enqueue(
                      sseEvent('agent-error', {
                        error: String(event.result.error || 'Action failed'),
                      }),
                    )
                  }
                  break

                case 'request.completed':
                  controller.enqueue(sseEvent('complete', {}))
                  safeClose(controller)
                  return

                case 'request.failed':
                  controller.enqueue(sseEvent('agent-error', { error: event.error }))
                  safeClose(controller)
                  return

                default:
                  break
              }
            }

            controller.enqueue(sseEvent('complete', {}))
            safeClose(controller)
          } catch (err) {
            console.error('[agentEvents] resume error:', err)
            try {
              controller.enqueue(sseEvent('agent-error', { error: 'Resume error' }))
            } catch {
              /* already errored */
            }
            safeClose(controller)
          }
        },
      })

      return new Response(body, { headers: sseHeaders() })
    },
  },
})
