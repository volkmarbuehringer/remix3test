import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { INTENTS, INTENT_TO_ACTION } from '../intents.ts'
import { frames } from '../../../routes.ts'

function actionLabel(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

const PERIOD_VALUES = ['today', 'this-week', 'this-month', 'next-week', 'next-month']
const STATUS_VALUES = ['pending', 'expired']

function sanitizeFilterParam(value: unknown, allowed: readonly string[]): string | undefined {
  let v = typeof value === 'string' ? value.trim() : ''
  return allowed.includes(v) ? v : undefined
}

export const dispatchHandler: EventHandler = {
  name: 'dispatch',
  eventType: 'entities.resolved',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'entities.resolved' }
    let resolved = e.resolved
    let actionInput: Record<string, unknown> = {
      ...resolved,
      adminUserId: e.adminUserId,
      adminEmail: e.adminEmail,
    }

    let navValue = String(resolved.targetEmail || resolved.targetName || resolved.targetQuery || '')
    let navQuery = navValue ? encodeURIComponent(navValue) : ''

    if (e.intent === INTENTS.LOOKUP_USER) {
      emit({
        type: 'navigate',
        href: '/admin/users' + (navQuery ? '?filter=' + navQuery : ''),
        target: frames.agentEventsPanel,
      })
      return
    }

    if (
      e.intent === INTENTS.CANCEL_USER ||
      e.intent === INTENTS.LOCK_USER ||
      e.intent === INTENTS.UNLOCK_USER
    ) {
      let action = INTENT_TO_ACTION[e.intent] ?? e.intent
      emit({
        type: 'workflow.requested',
        workflowId: 'userManagementWorkflow',
        input: { action, ...actionInput },
        navigate: {
          href: '/admin/users' + (navQuery ? '?filter=' + navQuery : ''),
          target: frames.agentEventsPanel,
        },
        summary: `${actionLabel(action)} user ${resolved.targetUserId || resolved.targetName || resolved.targetEmail}`,
      })
      return
    }

    if (e.intent === INTENTS.DELETE_APPOINTMENTS) {
      let targetUserId = Number(resolved.targetUserId || 0)
      let resourceId = Number(resolved.resourceId || 0)
      let filterValue = String(resolved.targetEmail || resolved.targetQuery || '')
      let href =
        '/verwaltung/appointments' +
        (filterValue ? '?filter=' + encodeURIComponent(filterValue) : '')
      emit({
        type: 'workflow.requested',
        workflowId: 'deleteUserAppointmentsWorkflow',
        input: {
          action: INTENT_TO_ACTION[INTENTS.DELETE_APPOINTMENTS] ?? 'delete-resource',
          targetUserId,
          resourceId,
          ...(resolved.targetEmail ? { targetEmail: resolved.targetEmail } : {}),
          adminUserId: e.adminUserId,
          adminEmail: e.adminEmail,
        },
        navigate: {
          href,
          target: frames.agentEventsPanel,
        },
        summary: `Delete appointments for ${targetUserId || resolved.targetQuery} on ${resourceId || resolved.resourceQuery}`,
      })
      return
    }

    if (e.intent === INTENTS.SHOW_APPOINTMENTS) {
      let val = String(resolved.targetEmail || resolved.targetQuery || '')
      let params = new URLSearchParams()
      if (val) params.set('filter', val)
      let period = sanitizeFilterParam(e.params.period, PERIOD_VALUES)
      if (period) params.set('period', period)
      let status = sanitizeFilterParam(e.params.status, STATUS_VALUES)
      if (status) params.set('status', status)
      let qs = params.toString()
      let href = '/verwaltung/appointments' + (qs ? '?' + qs : '')
      emit({ type: 'navigate', href, target: frames.agentEventsPanel })
      return
    }

    emit({ type: 'message', text: `Unknown intent: ${e.intent}` })
  },
}
