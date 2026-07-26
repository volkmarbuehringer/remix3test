export const MAX_MESSAGE_LENGTH = 5000

export type BaseEvent =
  | { type: 'request.received'; message: string }
  | { type: 'request.validated'; message: string }
  | { type: 'request.invalid'; error: string }
  | { type: 'intent.classified'; intent: string; params: Record<string, unknown> }
  | { type: 'intent.unclear'; text: string }
  | {
      type: 'entities.resolved'
      intent: string
      params: Record<string, unknown>
      resolved: Record<string, unknown>
    }
  | { type: 'entities.notfound'; error: string }
  | { type: 'action.running'; workflowId: string; input: Record<string, unknown>; summary: string }
  | { type: 'navigate'; href: string; target: string }
  | { type: 'message'; text: string }
  | {
      type: 'confirm.required'
      question: string
      actionType: string
      payload: Record<string, unknown>
    }
  | { type: 'confirm.skipped'; reason: string }
  | { type: 'confirm.resolved'; confirmed: boolean; payload?: Record<string, unknown> }
  | { type: 'action.completed'; success: boolean; result: Record<string, unknown> }
  | { type: 'request.completed'; result: Record<string, unknown> }
  | { type: 'request.failed'; error: string }

export type EventHandler = {
  name: string
  eventType: BaseEvent['type']
  handle(event: BaseEvent, emit: (e: BaseEvent) => void): Promise<void> | void
}

export class EventBus {
  #handlers = new Map<string, EventHandler[]>()

  register(handler: EventHandler): void {
    let existing = this.#handlers.get(handler.eventType) || []
    existing.push(handler)
    this.#handlers.set(handler.eventType, existing)
  }

  async *run(initialEvent: BaseEvent): AsyncGenerator<BaseEvent> {
    let queue: BaseEvent[] = [initialEvent]

    while (queue.length > 0) {
      let event = queue.shift()!
      yield event

      let handlers = this.#handlers.get(event.type) || []
      for (let handler of handlers) {
        let emitted: BaseEvent[] = []
        await handler.handle(event, (e) => void emitted.push(e))
        queue.push(...emitted)
      }
    }
  }
}
