import { type EventHandler, type BaseEvent, MAX_MESSAGE_LENGTH } from '../event-bus.ts'

export const validateHandler: EventHandler = {
  name: 'validate',
  eventType: 'request.received',
  handle(event, emit) {
    let e = event as BaseEvent & { type: 'request.received' }
    let message = e.message.trim()
    if (!message) {
      emit({ type: 'request.invalid', error: 'Message is required' })
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      emit({ type: 'request.invalid', error: `Message too long (max ${MAX_MESSAGE_LENGTH})` })
    } else {
      emit({ type: 'request.validated', message })
    }
  },
}
