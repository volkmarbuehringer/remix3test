import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { INTENTS, INTENT_TO_ACTION } from '../intents.ts'
import { frames } from '../../../routes.ts'

function actionLabel(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1)
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

    if (e.intent === INTENTS.SHOW_APPOINTMENTS) {
      let val = String(resolved.targetEmail || resolved.targetQuery || '')
      let href = '/verwaltung/appointments' + (val ? '?filter=' + encodeURIComponent(val) : '')
      emit({ type: 'navigate', href, target: frames.agentEventsPanel })
      return
    }

    emit({ type: 'message', text: `Unknown intent: ${e.intent}` })
  },
}
