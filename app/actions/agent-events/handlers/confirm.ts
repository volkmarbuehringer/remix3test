import type { EventHandler, BaseEvent } from '../event-bus.ts'

export const confirmHandler: EventHandler = {
  name: 'confirm',
  eventType: 'action.running',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'action.running' }
    emit({
      type: 'confirm.required',
      question: e.summary + '?',
      actionType: String(e.input.action || e.workflowId),
      payload: e.input,
    })
  },
}
