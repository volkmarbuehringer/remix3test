---
name: typescript-eventbus-bfs-async-generator
description: "Typed event bus using TypeScript discriminated unions, async generator BFS, and depth-limit cycle detection"
user-invocable: false
origin: auto-extracted
---

# Typed Event Bus with Async Generator BFS

**Extracted:** 2026-07-26
**Context:** Building an in-process event-driven pipeline where typed events flow through registered handlers, each handler emits zero or more downstream events, and the pipeline is consumed as an async iterable for SSE streaming (or similar).

## Problem

When building an event-driven pipeline with TypeScript, you need:

1. **Type safety** — Each event has a shape. Handlers should know what they receive.
2. **Breadth-first processing** — Events emitted by handlers should be processed in FIFO order, not recursively stacked.
3. **Cycle protection** — A handler that emits an event of the same type it listens for creates an infinite loop (e.g., a `message` handler that emits `message` events).
4. **Consumable as a stream** — The pipeline should be consumable as an async iterable so the caller can yield each event to SSE (or log, or forward) as it happens.

Using a simple recursive call chain (handler calls handler directly) causes stack overflow on deep chains and doesn't yield intermediate events to the consumer.

## Solution

Use an `EventBus` class with a typed discriminated union for events, a `Map` of registrations, and an async generator that processes events breadth-first from a queue. Add a `maxDepth` guard to abort if the queue grows beyond a reasonable limit.

```typescript
// Step 1: Define the event types as a discriminated union
export type AppEvent =
  | { type: 'request.received'; message: string }
  | { type: 'request.validated'; message: string }
  | { type: 'intent.classified'; intent: string; params: Record<string, unknown> }
  | { type: 'navigate'; href: string; target: string }
  | { type: 'message'; text: string }

// Step 2: Handler interface — subscribes to ONE event type
export type EventHandler = {
  name: string
  eventType: AppEvent['type']
  handle(event: AppEvent, emit: (e: AppEvent) => void): Promise<void> | void
}

// Step 3: EventBus with BFS and depth limit
export class EventBus {
  #handlers = new Map<string, EventHandler[]>()

  register(handler: EventHandler): void {
    let existing = this.#handlers.get(handler.eventType) || []
    existing.push(handler)
    this.#handlers.set(handler.eventType, existing)
  }

  async *run(initialEvent: AppEvent, maxDepth = 100): AsyncGenerator<AppEvent> {
    let queue: AppEvent[] = [initialEvent]
    let depth = 0

    while (queue.length > 0 && depth < maxDepth) {
      let event = queue.shift()!
      yield event

      let handlers = this.#handlers.get(event.type) || []
      for (let handler of handlers) {
        let emitted: AppEvent[] = []
        await handler.handle(event, (e) => void emitted.push(e))
        queue.push(...emitted)
      }
      depth++
    }

    if (depth >= maxDepth) {
      console.warn('[EventBus] max depth reached — possible cycle')
    }
  }
}
```

### Key mechanics

| Concern | How it's handled |
|---------|-----------------|
| **Type safety** | Discriminated union `AppEvent` — each handler casts its input (or use generic `EventHandler<T>` for stricter typing) |
| **BFS order** | A `queue` array. `shift()` the next event, `push()` emitted events to the back |
| **Cycle detection** | `maxDepth` guard — if depth exceeds the limit, log a warning and stop. Prevents infinite loops from self-referencing handlers |
| **Async consumption** | The generator yields each event. The consumer can `for await (let event of bus.run(initialEvent))` and do whatever it needs (SSE, logging, etc.) |
| **No shared state** | The `emit` callback creates a closure over a local `emitted` array. Each handler invocation gets its own array |

### Common pitfalls

**Handler casts.** Because `EventHandler.handle` receives `AppEvent` (the full union), each handler casts its input to a narrower type:

```typescript
export const validateHandler: EventHandler = {
  name: 'validate',
  eventType: 'request.received',
  async handle(event, emit) {
    let e = event as AppEvent & { type: 'request.received' }
    // e is now typed with the correct shape
    if (!e.message.trim()) {
      emit({ type: 'request.invalid', error: 'Message is required' })
    }
  },
}
```

For stricter typing, parameterize `EventHandler`:

```typescript
export type EventHandler<T extends AppEvent = AppEvent> = {
  name: string
  eventType: T['type']
  handle(event: T, emit: (e: AppEvent) => void): Promise<void> | void
}
```

Then handlers use the specific variant without casting:

```typescript
export const validateHandler: EventHandler<AppEvent & { type: 'request.received' }> = {
  name: 'validate',
  eventType: 'request.received',
  handle(event, emit) {
    // event is typed as AppEvent narrowed to 'request.received'
  },
}
```

**Race condition with outer signal.** When the consumer needs to abort (e.g., HTTP request cancelled), pass an `AbortSignal` into the `run()` method:

```typescript
async *run(initialEvent: AppEvent, signal?: AbortSignal, maxDepth = 100) {
  let queue: AppEvent[] = [initialEvent]
  let depth = 0
  while (queue.length > 0 && depth < maxDepth) {
    let event = queue.shift()!
    yield event
    if (signal?.aborted) break
    // ... process handlers
  }
}
```

**Controlling handler order.** Registration order determines processing order. If handler A must run before handler B, register A first. Make the registration function the single source of truth for flow:

```typescript
export function registerHandlers(bus: EventBus): void {
  bus.register(validateHandler)
  bus.register(classifyHandler)
  bus.register(dispatchHandler)
}
```

## When to Use

- Building an in-process event pipeline where events flow through typed handlers
- You need to yield each event to an external consumer (SSE, WebSocket, log stream)
- The pipeline has branching (handler emits multiple event types, each routed to different downstream handlers)
- You want cycle-safe processing with a depth limit

## When NOT to Use

- You need persistence, replay, or message delivery guarantees — use a real message queue (RabbitMQ, Kafka, SQS)
- The pipeline is strictly linear with no branching — a simple function chain is simpler
- You need distributed processing across services — this is an in-process pattern only
