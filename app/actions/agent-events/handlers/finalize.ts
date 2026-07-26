import type { EventHandler, BaseEvent } from '../event-bus.ts'

export const finalizeHandler: EventHandler = {
  name: 'finalize',
  eventType: 'action.completed',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'action.completed' }
    emit({ type: 'request.completed', result: { success: e.success, ...e.result } })
  },
}
