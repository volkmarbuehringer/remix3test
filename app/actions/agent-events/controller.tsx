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
import { pipeWorkflowStream } from './workflow-sse.ts'
import {
  upsertActiveRun,
  markSuspended,
  clearActiveRun,
  findActiveRun,
  findRunById,
} from './active-run-store.ts'

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
    ...(opts.closeOnSuspend !== undefined ? { closeOnSuspend: opts.closeOnSuspend } : {}),
  })
  return { runId: stream.runId, fullStream: stream.fullStream }
}

let _runFactory: RunFactory = defaultRunFactory
export function __setRunFactory(fn: RunFactory | undefined) {
  _runFactory = fn ?? defaultRunFactory
}

// Injectable run-status resolver for the reconnect snapshot verification, so
// tests can stub Mastra storage (mirrors __setRunFactory). Returns the live
// snapshot status plus the suspended step's payload/id when the run suspended.
type RunSnapshot = {
  status: string
  stepId?: string | undefined
  suspendPayload?: Record<string, unknown> | undefined
}
type RunStatusResolver = (workflowId: string, runId: string) => Promise<RunSnapshot | null>

const defaultRunStatusResolver: RunStatusResolver = async (workflowId, runId) => {
  let wf = realMastra.getWorkflow(
    workflowId as 'userManagementWorkflow' | 'deleteUserAppointmentsWorkflow',
  )
  let run = await wf.getWorkflowRunById(runId)
  if (!run) return null
  // The snapshot's steps retain the suspended step's payload (see
  // workflow-event-processor cleanStepResult); fall back to the index row.
  let stepId: string | undefined
  let suspendPayload: Record<string, unknown> | undefined
  for (let [id, step] of Object.entries((run.steps as Record<string, unknown>) ?? {})) {
    let s = step as { status?: string; suspendPayload?: Record<string, unknown> }
    if (s?.status === 'suspended') {
      stepId = id
      suspendPayload = s.suspendPayload
      break
    }
  }
  return { status: run.status, stepId, suspendPayload }
}

let _runStatusResolver: RunStatusResolver = defaultRunStatusResolver
export function __setRunStatusResolver(fn: RunStatusResolver | undefined) {
  _runStatusResolver = fn ?? defaultRunStatusResolver
}

// Tracks the workflow used to start a run so a subsequent resume can re-attach
// to the correct workflow. Bounded and
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
                  await upsertActiveRun(user.id, {
                    runId,
                    workflowId: event.workflowId,
                    status: 'running',
                  })
                  controller.enqueue(sseEvent('start', { runId, workflowId: event.workflowId }))
                  await pipeWorkflowStream(fullStream, controller, context.request.signal, {
                    includeReport: false,
                    runId,
                    workflowId: event.workflowId,
                    onRunState: (state) => {
                      if (state.phase === 'suspended') {
                        return markSuspended(user.id, runId, state.stepId, state.suspendPayload)
                      }
                      if (
                        state.phase === 'finished' ||
                        state.phase === 'error' ||
                        state.phase === 'canceled'
                      ) {
                        return clearActiveRun(user.id, runId)
                      }
                    },
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
      let adminId = getCurrentUser().id
      // Resolve the workflow for THIS run id from the durable index (not the
      // admin's current active run — that may have moved to a newer run).
      let runRow = await findRunById(runId)
      // Only enforce ownership when the run is indexed; a run with no index row
      // (pre-reconnect flow) is resolved purely from the client/memory.
      if (runRow && runRow.adminUserId !== adminId) {
        return sseErrorResponse('Unknown runId: cannot determine workflow to resume', 400)
      }
      let workflowId =
        context.formData.get('workflowId')?.toString() ||
        lookupRunWorkflow(runId) ||
        runRow?.workflowId
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
              runId,
              workflowId,
              onRunState: (state) => {
                if (state.phase === 'suspended') {
                  return markSuspended(adminId, runId, state.stepId, state.suspendPayload)
                }
                if (
                  state.phase === 'finished' ||
                  state.phase === 'error' ||
                  state.phase === 'canceled'
                ) {
                  return clearActiveRun(adminId, runId)
                }
              },
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

    async reconnect(context) {
      let adminId = getCurrentUser().id
      let row = await findActiveRun(adminId)
      if (!row) {
        return context.json({ status: 'none' })
      }

      // The index is a pointer; the Mastra snapshot is the source of truth.
      // Reconnect is best-effort: a resolver failure (unknown workflow, storage
      // down) must not 500 — treat the run as unavailable and clear the stale
      // pointer so a later reconnect can recover.
      let run: RunSnapshot | null
      try {
        run = await _runStatusResolver(row.workflowId, row.runId)
      } catch {
        await clearActiveRun(adminId, row.runId)
        return context.json({ status: 'none' })
      }

      if (!run) {
        // Run gone from storage entirely → truly stale.
        await clearActiveRun(adminId, row.runId)
        return context.json({ status: 'none' })
      }

      if (run.status === 'running') {
        // Still in flight (e.g. mid-flight reload before the gate): the run is
        // executing in the background and may suspend momentarily. Keep the row
        // and surface nothing yet — a later reconnect will recover it.
        return context.json({ status: 'none' })
      }

      if (run.status !== 'suspended') {
        // success / failed / canceled → stale.
        await clearActiveRun(adminId, row.runId)
        return context.json({ status: 'none' })
      }

      // The run suspended. The index payload may be NULL when the run suspended
      // after the SSE loop died (mid-flight reload), so fall back to the
      // snapshot's suspended step payload.
      let payload = row.suspendPayload ?? run.suspendPayload
      if (!payload) {
        return context.json({ status: 'none' })
      }
      return context.json({
        status: 'suspended',
        runId: row.runId,
        workflowId: row.workflowId,
        stepId: row.stepId ?? run.stepId ?? null,
        suspendPayload: payload,
      })
    },
  },
})
