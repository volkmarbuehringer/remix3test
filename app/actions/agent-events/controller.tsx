import { createController } from 'remix/router'
import { css, type Handle } from 'remix/ui'
import { requireAdmin } from '../../middleware/admin.ts'
import { sseHeaders, sseErrorResponse, sseEvent, safeClose } from '../../utils/agent-sse.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { AgentEventsPage } from '../../ui/agent-events-page.tsx'
import { routes, frames } from '../../routes.ts'
import { EventBus, type BaseEvent, MAX_MESSAGE_LENGTH } from './event-bus.ts'
import { INTENTS } from './intents.ts'
import { registerHandlers } from './register.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { mastra as realMastra } from '../mastra/index.ts'
import { pipeWorkflowStream } from '../workflow-agent/workflow-sse.ts'

// Injectable run-starter seam so tests can stub the Mastra workflow run without
// initializing Mastra or a real run (mirrors the __setAgent/__setExecutors
// pattern used by the handlers).
type RunStream = { runId: string; fullStream: ReadableStream<unknown> | AsyncIterable<unknown> }
type RunFactory = (
  workflowId: string,
  opts: {
    resourceId?: string
    runId?: string
    inputData?: Record<string, unknown>
    resumeData?: { confirmed: boolean }
    closeOnSuspend?: boolean
  },
) => Promise<RunStream>

const defaultRunFactory: RunFactory = async (workflowId, opts) => {
  let wf = realMastra.getWorkflow(
    workflowId as 'userManagementWorkflow' | 'deleteUserAppointmentsWorkflow',
  )
  if (opts.runId != null) {
    let run = await wf.createRun({ runId: opts.runId })
    let stream = run.resumeStream({ resumeData: opts.resumeData as { confirmed: boolean } })
    return { runId: stream.runId, fullStream: stream.fullStream }
  }
  let run = await wf.createRun({ resourceId: opts.resourceId as string })
  // getWorkflow(union) narrows run.stream's inputData to the intersection of the
  // two workflow input schemas; cast to that intersection (extra fields such as
  // the user-management `action` are stripped by the per-workflow zod schema).
  let stream = run.stream({
    inputData: opts.inputData as {
      action: 'cancel' | 'lock' | 'unlock'
      targetUserId: number
      resourceId: number
      adminUserId: number
      adminEmail: string
    },
    closeOnSuspend: opts.closeOnSuspend,
  })
  return { runId: stream.runId, fullStream: stream.fullStream }
}

let _runFactory: RunFactory = defaultRunFactory
export function __setRunFactory(fn: RunFactory | undefined) {
  _runFactory = fn ?? defaultRunFactory
}

// Tracks the workflow used to start a run so a subsequent resume can re-attach
// to the correct workflow (mirrors the workflow-agent run map). Bounded and
// TTL-expired: a resume must never silently guess a workflow when the run is
// unknown, which would re-attach a delete run to userManagementWorkflow.
const WORKFLOW_MAP_MAX = 200
const WORKFLOW_MAP_TTL_MS = 1000 * 60 * 60 // 1 hour
const workflowRunMap = new Map<string, { workflowId: string; ts: number }>()

function recordRunWorkflow(runId: string, workflowId: string): void {
  let now = Date.now()
  for (let [k, v] of workflowRunMap) {
    if (now - v.ts > WORKFLOW_MAP_TTL_MS) workflowRunMap.delete(k)
  }
  if (workflowRunMap.size >= WORKFLOW_MAP_MAX) {
    let oldest = workflowRunMap.keys().next().value
    if (oldest != null) workflowRunMap.delete(oldest)
  }
  workflowRunMap.set(runId, { workflowId, ts: now })
}

function lookupRunWorkflow(runId: string): string | undefined {
  let entry = workflowRunMap.get(runId)
  if (!entry) return undefined
  if (Date.now() - entry.ts > WORKFLOW_MAP_TTL_MS) {
    workflowRunMap.delete(runId)
    return undefined
  }
  return entry.workflowId
}

function AgentEventsEmptyState(_handle: Handle) {
  return () => (
    <div
      mix={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: theme.space.md,
        padding: theme.space.xl,
        textAlign: 'center',
      })}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.colors.text.muted}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <div
        mix={css({
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.text.primary,
        })}
      >
        No agent events yet
      </div>
      <p
        mix={css({
          margin: 0,
          maxWidth: '26rem',
          fontSize: theme.fontSize.sm,
          lineHeight: theme.lineHeight.relaxed,
          color: theme.colors.text.muted,
        })}
      >
        Send a command below to watch the event pipeline — input validation, intent classification,
        entity resolution and confirmation gates will stream here.
      </p>
      <div
        mix={css({
          marginTop: theme.space.sm,
          padding: `${theme.space.sm} ${theme.space.md}`,
          borderRadius: theme.radius.md,
          background: theme.surface.lvl1,
          border: `1px solid ${theme.colors.border.subtle}`,
          fontFamily: theme.fontFamily.mono,
          fontSize: theme.fontSize.xs,
          color: theme.colors.text.secondary,
        })}
      >
        e.g. &quot;cancel user 42&quot; or &quot;show appointments&quot;
      </div>
    </div>
  )
}

export default createController(routes.admin.agentEvents, {
  middleware: [requireAdmin()],

  actions: {
    async index(context) {
      return renderAdminPage(context.render, 'agentevents', <AgentEventsPage />)
    },

    async panel(context) {
      return context.render(<AgentEventsEmptyState />)
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

      let user = getCurrentUser()
      let body = new ReadableStream({
        start: async (controller) => {
          let bus = new EventBus()
          registerHandlers(bus)
          let initialEvent: BaseEvent = {
            type: 'request.received',
            message,
            adminUserId: user.id,
            adminEmail: user.email,
          }

          for await (let event of bus.run(initialEvent)) {
            if (context.request.signal.aborted) break

            switch (event.type) {
              case 'request.validated':
                controller.enqueue(sseEvent('status', { text: 'Input validated', kind: 'success' }))
                break

              case 'request.invalid':
                controller.enqueue(sseEvent('agent-error', { error: event.error }))
                safeClose(controller)
                return

              case 'intent.classified':
                controller.enqueue(
                  sseEvent('status', {
                    text: `Intent resolved: ${event.intent}`,
                    kind: 'success',
                  }),
                )
                break

              case 'intent.unclear':
                controller.enqueue(sseEvent('message', { text: event.text }))
                controller.enqueue(sseEvent('complete', {}))
                safeClose(controller)
                return

              case 'entities.resolved':
                controller.enqueue(
                  sseEvent('status', { text: 'Entities resolved', kind: 'success' }),
                )
                break

              case 'entities.notfound':
                controller.enqueue(
                  sseEvent('navigate', {
                    href:
                      event.intent === INTENTS.DELETE_APPOINTMENTS
                        ? routes.verwaltung.appointments.index.href()
                        : '/admin/users',
                    target: frames.agentEventsPanel,
                    history: 'push',
                  }),
                )
                controller.enqueue(sseEvent('message', { text: event.error }))
                controller.enqueue(sseEvent('complete', {}))
                safeClose(controller)
                return

              case 'workflow.requested': {
                controller.enqueue(
                  sseEvent('navigate', {
                    href: event.navigate.href,
                    target: event.navigate.target,
                    history: 'push',
                  }),
                )
                let input = event.input as Record<string, unknown>
                let targetUserId = Number(input.targetUserId || 0)
                let inputData = {
                  action: input.action as 'cancel' | 'lock' | 'unlock' | 'delete-resource',
                  targetUserId,
                  resourceId: Number(input.resourceId || 0),
                  adminUserId: Number(input.adminUserId || 0),
                  adminEmail: String(input.adminEmail || ''),
                }
                try {
                  let { runId, fullStream } = await _runFactory(event.workflowId, {
                    resourceId: String(targetUserId),
                    inputData,
                    closeOnSuspend: false,
                  })
                  recordRunWorkflow(runId, event.workflowId)
                  controller.enqueue(sseEvent('start', { runId, workflowId: event.workflowId }))
                  await pipeWorkflowStream(fullStream, controller, context.request.signal, {
                    includeReport: false,
                  })
                } catch (err) {
                  console.error('[agentEvents] start workflow error:', err)
                  try {
                    controller.enqueue(
                      sseEvent('agent-error', { error: 'Failed to start workflow' }),
                    )
                  } catch {
                    /* already errored */
                  }
                  safeClose(controller)
                }
                return
              }

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
                safeClose(controller)
                return
            }
          }

          controller.enqueue(sseEvent('complete', {}))
          safeClose(controller)
        },
      })

      return new Response(body, { headers: sseHeaders() })
    },

    async resume(context) {
      let runId = context.formData.get('runId')?.toString()
      if (!runId) {
        return sseErrorResponse('Missing runId', 400)
      }
      let confirmed = context.formData.get('confirmed')?.toString() === 'true'
      let workflowId = context.formData.get('workflowId')?.toString() || lookupRunWorkflow(runId)
      // Never guess a workflow: resuming an unknown run against the wrong
      // workflow (e.g. a delete run defaulted to userManagementWorkflow) would
      // silently re-attach the wrong semantics — fail fast instead.
      if (!workflowId) {
        return sseErrorResponse('Unknown runId: cannot determine workflow to resume', 400)
      }

      let body = new ReadableStream({
        start: async (controller) => {
          try {
            let { runId: outRunId, fullStream } = await _runFactory(workflowId, {
              runId,
              resumeData: { confirmed },
            })
            controller.enqueue(sseEvent('start', { runId: outRunId, workflowId }))
            await pipeWorkflowStream(fullStream, controller, context.request.signal, {
              includeReport: false,
            })
          } catch (err) {
            console.error('[agentEvents] resume error:', err)
            try {
              controller.enqueue(sseEvent('agent-error', { error: 'Failed to resume workflow' }))
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
