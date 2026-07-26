import type { EventHandler, BaseEvent } from '../event-bus.ts'

export const dispatchHandler: EventHandler = {
  name: 'dispatch',
  eventType: 'entities.resolved',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'entities.resolved' }
    let resolved = e.resolved
    let actionInput: Record<string, unknown> = { ...resolved }

    let navQuery = resolved.targetEmail
      ? encodeURIComponent(String(resolved.targetEmail))
      : resolved.targetName
        ? encodeURIComponent(String(resolved.targetName))
        : ''

    switch (e.intent) {
      case 'cancel-user':
      case 'lock-user':
      case 'unlock-user': {
        emit({
          type: 'navigate',
          href: '/admin/users' + (navQuery ? '?filter=' + navQuery : ''),
          target: 'admin-content',
        })
        emit({
          type: 'action.running',
          workflowId: 'userManagementWorkflow',
          input: { action: e.intent.replace('-user', ''), ...actionInput },
          summary: `${e.intent.replace('-user', '').charAt(0).toUpperCase() + e.intent.replace('-user', '').slice(1)} user ${resolved.targetUserId || resolved.targetName || resolved.targetEmail}`,
        })
        break
      }

      case 'show-appointments':
        emit({
          type: 'navigate',
          href:
            '/verwaltung/appointments' +
            (resolved.targetEmail
              ? '?filter=' + encodeURIComponent(String(resolved.targetEmail))
              : ''),
          target: 'admin-content',
        })
        break

      default:
        emit({ type: 'message', text: `Unknown intent: ${e.intent}` })
    }
  },
}
