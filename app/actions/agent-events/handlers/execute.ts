import type { EventHandler, BaseEvent } from '../event-bus.ts'

export const executeHandler: EventHandler = {
  name: 'execute',
  eventType: 'confirm.resolved',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'confirm.resolved' }
    if (!e.confirmed) {
      emit({ type: 'action.completed', success: false, result: { error: 'Cancelled by admin' } })
      return
    }
    emit({
      type: 'action.completed',
      success: true,
      result: { confirmed: true, payload: e.payload },
    })
  },
}
