import { AsyncLocalStorage } from 'node:async_hooks'

// The request's current abort signal, shared with data helpers that do not
// receive the request context directly. This is intentionally scoped per async
// call chain (AsyncLocalStorage), so parallel requests cannot see each other's
// signals.
const storage = new AsyncLocalStorage<AbortSignal>()

/** Run `callback` with `signal` available to nested query/read helpers. */
export function runWithRequestSignal<T>(signal: AbortSignal, callback: () => T): T {
  return storage.run(signal, callback)
}

/** The abort signal for the current async request chain, if any. */
export function getRequestSignal(): AbortSignal | undefined {
  return storage.getStore()
}
