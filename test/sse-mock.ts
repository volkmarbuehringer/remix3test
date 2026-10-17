let createdEventSources: MockEventSource[] = []
let originalEventSource: typeof EventSource | null = null

export class MockEventSource {
  url: string
  readyState: number = EventSource.CONNECTING
  #listeners = new Map<string, Set<(event: MessageEvent) => void>>()
  #closed = false

  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  constructor(url: string) {
    this.url = url
    createdEventSources.push(this)
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
    this.#listeners.get(type)!.add(handler)
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.#listeners.get(type)?.delete(handler)
  }

  dispatchEvent(event: Event): boolean {
    let type = event.type
    let handlers = this.#listeners.get(type)
    if (handlers) {
      for (let handler of handlers) {
        handler(event as MessageEvent)
      }
    }
    return true
  }

  close() {
    this.#closed = true
    this.readyState = EventSource.CLOSED
    if (!createdEventSources.includes(this)) return
  }

  get closed(): boolean {
    return this.#closed
  }

  /** Simulate opening the connection. Dispatches an 'open' event and sets readyState. */
  open() {
    this.readyState = EventSource.OPEN
    this.dispatchEvent(new MessageEvent('open'))
  }

  /** Emit a named SSE event with optional JSON data */
  emit(type: string, data: unknown) {
    let json = typeof data === 'string' ? data : JSON.stringify(data)
    let event = new MessageEvent(type, { data: json })
    try {
      this.dispatchEvent(event)
    } catch {
      // Event handler errors (e.g. missing frame context) are suppressed
      // so tests can verify dispatch behavior without crashing
    }
    if (type === 'message') {
      try {
        this.dispatchEvent(new MessageEvent('message', { data: json }))
      } catch {
        // Same suppression for message events
      }
    }
  }

  /** Emit an error event */
  emitError() {
    this.dispatchEvent(new Event('error'))
  }
}

export function installSseMock() {
  originalEventSource = window.EventSource
  window.EventSource = MockEventSource as unknown as typeof EventSource
  createdEventSources = []
}

export function uninstallSseMock() {
  if (originalEventSource) {
    window.EventSource = originalEventSource
    originalEventSource = null
  }
  createdEventSources = []
}

export function getCreatedEventSources(): MockEventSource[] {
  return createdEventSources
}

export function resetCreatedEventSources() {
  createdEventSources = []
}
