import type { EventHandler, BaseEvent } from '../event-bus.ts'

export const resolveHandler: EventHandler = {
  name: 'resolve',
  eventType: 'intent.classified',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'intent.classified' }
    let targetQuery = String(e.params.targetQuery || '').trim()

    if (!targetQuery) {
      emit({
        type: 'entities.notfound',
        error: 'No target specified. Please provide a user name, email, or ID.',
      })
      return
    }

    let targetId = Number(targetQuery)
    if (!Number.isNaN(targetId) && Number.isInteger(targetId) && targetId > 0) {
      emit({
        type: 'entities.resolved',
        intent: e.intent,
        params: e.params,
        resolved: { targetUserId: targetId, targetQuery },
      })
    } else if (targetQuery.includes('@')) {
      emit({
        type: 'entities.resolved',
        intent: e.intent,
        params: e.params,
        resolved: { targetEmail: targetQuery, targetQuery },
      })
    } else {
      emit({
        type: 'entities.resolved',
        intent: e.intent,
        params: e.params,
        resolved: { targetName: targetQuery, targetQuery },
      })
    }
  },
}
