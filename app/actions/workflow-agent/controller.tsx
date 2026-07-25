import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { sseHeaders, sseErrorResponse, sseEvent } from '../../utils/agent-sse.ts'
import { pipeWorkflowStream, type WorkflowResult } from './workflow-sse.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { WorkflowAgentPage } from '../../ui/workflow-agent-page.tsx'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { db } from '../../data/connection.ts'
import { AGENT_TIMEOUT_MS } from '../mastra/shared-agent.ts'

const MAX_MESSAGE_LENGTH = 5000

export function _agentThreadId(userId?: number): string {
  let uid = userId ?? getCurrentUser().id
  let env = process.env.APP_ENV || process.env.NODE_ENV || 'dev'
  return `admin-${env}-${uid}`
}

export async function _recordWorkflowResult(result: WorkflowResult | null) {
  if (!result) return
  try {
    let agent = mastra.getAgent('workflowAgent')
    let summary = JSON.stringify(result)
    let user = getCurrentUser()
    await agent.generate(`Workflow result recorded: ${summary}`, {
      memory: { thread: _agentThreadId(), resource: String(user.id) },
    })
  } catch (err) {
    console.error('[workflowAgent] failed to record workflow result:', err)
  }
}

async function resolveTargetUser(query: string): Promise<{ targetUserId: number } | { error: string }> {
  let targetId = Number(query)
  if (!Number.isNaN(targetId) && Number.isInteger(targetId) && targetId > 0) {
    let result = await db.exec('SELECT id FROM users WHERE id = $1', [targetId])
    if ((result.rows ?? [])[0]) return { targetUserId: targetId }
    return { error: `User with ID ${targetId} not found` }
  }
  let pattern = `%${query}%`
  let result = await db.exec(
    'SELECT id, name, email FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name',
    [pattern],
  )
  let rows = (result.rows ?? []) as Array<{ id: number; name: string; email: string }>
  if (rows.length === 0) return { error: `No user found matching "${query}"` }
  let names = rows.map((r) => `${r.name} (${r.email})`).join(', ')
  if (rows.length > 1) return { error: `Multiple users match "${query}": ${names}. Please be more specific.` }
  return { targetUserId: rows[0].id }
}

function getTarget(path: string): string {
  let prefixes: [string, string][] = [
    ['/admin', 'admin-content'],
    ['/mastra', 'admin-content'],
    ['/verwaltung', 'admin-content'],
    ['/workflow-agent', 'admin-content'],
    ['/lists', 'lists-content'],
  ]
  let match: [string, string] | undefined
  for (let [prefix, target] of prefixes) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      if (!match || prefix.length > match[0].length) match = [prefix, target]
    }
  }
  return match?.[1] ?? 'admin-content'
}

export const workflowAgent = createController(
  routes.workflowAgent,
  {
    middleware: [requireAdmin()],

    actions: {
      async index(context) {
        return context.render(
          <Layout title="Workflow-Agent">
            <WorkflowAgentPage />
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
            Ask the agent to manage a user account...
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

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              // Phase 1: Intent resolution via agent (with memory)
              let agent = mastra.getAgent('workflowAgent')
              let user = getCurrentUser()
              let intentResult = await agent.generate(message, {
                maxSteps: 3,
                memory: { thread: _agentThreadId(user.id), resource: String(user.id) },
                abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
              })
              let intentText = intentResult.text?.trim() || ''
              let intent: Record<string, unknown> | null = null

              try {
                intent = JSON.parse(intentText)
              } catch {
                intent = extractJson(intentText)
              }
              if (!intent || typeof intent !== 'object') {
                controller.enqueue(sseEvent('message', { text: intentText || 'Could you clarify that?' }))
                controller.enqueue(sseEvent('complete', {}))
                safeClose(controller)
                return
              }

              // Handle appointment navigation
              if (intent.type === 'appointment') {
                let params = new URLSearchParams()
                if (intent.filter) params.set('filter', String(intent.filter))
                if (intent.period) params.set('period', String(intent.period))
                if (intent.status) params.set('status', String(intent.status))
                let qs = params.toString()
                let href = '/verwaltung/appointments' + (qs ? '?' + qs : '')
                controller.enqueue(sseEvent('navigate', {
                  href,
                  target: 'admin-content',
                  history: 'push',
                }))
                controller.enqueue(sseEvent('complete', {}))
                safeClose(controller)
                return
              }

              // Handle user actions
              if (intent.type === 'user-action') {
                let action = String(intent.action || '')
                let targetQuery = String(intent.targetQuery || '')

                if (!['cancel', 'lock', 'unlock', 'lookup'].includes(action)) {
                  controller.enqueue(sseEvent('message', { text: `Unknown action: ${action}` }))
                  controller.enqueue(sseEvent('complete', {}))
                  safeClose(controller)
                  return
                }

                if (!targetQuery) {
                  controller.enqueue(sseEvent('message', { text: 'Which user? Please specify a name, email, or ID.' }))
                  controller.enqueue(sseEvent('complete', {}))
                  safeClose(controller)
                  return
                }

                let resolved = await resolveTargetUser(targetQuery)
                if ('error' in resolved) {
                  controller.enqueue(sseEvent('message', { text: resolved.error }))
                  controller.enqueue(sseEvent('complete', {}))
                  safeClose(controller)
                  return
                }

                // Navigate to admin users grid so admin can see the user
                let navHref = '/admin/users?filter=' + encodeURIComponent(targetQuery)
                controller.enqueue(sseEvent('navigate', {
                  href: navHref,
                  target: 'admin-content',
                  history: 'push',
                }))

                // Handle lookup — just navigate, no workflow
                if (action === 'lookup') {
                  controller.enqueue(sseEvent('complete', {}))
                  safeClose(controller)
                  return
                }

                // Phase 2: Start workflow for cancel/lock/unlock
                let wf = mastra.getWorkflow('userManagementWorkflow')
                let run = await wf.createRun({ resourceId: String(resolved.targetUserId) })
                let stream = run.stream({
                  inputData: {
                    action: action as 'cancel' | 'lock' | 'unlock',
                    targetUserId: resolved.targetUserId,
                    adminUserId: user.id,
                    adminEmail: user.email,
                  },
                  closeOnSuspend: false,
                })

                controller.enqueue(sseEvent('start', { runId: stream.runId }))
                let result = await pipeWorkflowStream(stream.fullStream, controller, context.request.signal)
                await _recordWorkflowResult(result)
                return
              }

              controller.enqueue(sseEvent('message', { text: `Unrecognized intent type: ${intent.type}. Please try rephrasing.` }))
              controller.enqueue(sseEvent('complete', {}))
              safeClose(controller)
            } catch (err) {
              console.error('[workflowAgent] action error:', err)
              try {
                controller.enqueue(sseEvent('agent-error', { error: 'Failed to process request' }))
              } catch { /* already errored */ }
              safeClose(controller)
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async resume(context) {
        let runId = context.formData.get('runId')?.toString()
        let confirmed = context.formData.get('confirmed')?.toString() === 'true'

        if (!runId) {
          return sseErrorResponse('Missing runId', 400)
        }

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let wf = mastra.getWorkflow('userManagementWorkflow')
              let run = await wf.createRun({ runId })
              let stream = run.resumeStream({
                resumeData: { confirmed },
              })

              controller.enqueue(sseEvent('start', { runId: stream.runId }))
              let result = await pipeWorkflowStream(stream.fullStream, controller, context.request.signal)
              await _recordWorkflowResult(result)
            } catch (err) {
              console.error('[workflowAgent] resume error:', err)
              try {
                controller.enqueue(sseEvent('agent-error', { error: 'Failed to resume workflow' }))
              } catch { /* already errored */ }
              safeClose(controller)
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async stream(context) {
        let runId = context.url.searchParams.get('runId')
        if (!runId) {
          return sseErrorResponse('Missing runId', 400)
        }

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let wf = mastra.getWorkflow('userManagementWorkflow')
              let run = await wf.createRun({ runId })
              let stream = run.resumeStream({})

              controller.enqueue(sseEvent('start', { runId: stream.runId }))
              let result = await pipeWorkflowStream(stream.fullStream, controller, context.request.signal)
              await _recordWorkflowResult(result)
            } catch (err) {
              console.error('[workflowAgent] stream error:', err)
              try {
                controller.enqueue(sseEvent('agent-error', { error: 'Failed to stream workflow' }))
              } catch { /* already errored */ }
              safeClose(controller)
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },
    },
  },
)

function extractJson(text: string): Record<string, unknown> | null {
  let start = text.indexOf('{')
  let end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {}
  }
  return null
}

function safeClose(controller: ReadableStreamDefaultController) {
  try { controller.close() } catch { /* already closed */ }
}
