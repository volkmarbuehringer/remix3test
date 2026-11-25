import type { Middleware } from 'remix/router'

import { runWithRequestSignal } from '../utils/request-signal.ts'

/**
 * Makes the request's current abort signal available to data helpers through
 * AsyncLocalStorage. It must run after requestTimeout() so the stored signal is
 * the combined client/deadline signal, and before database/auth middleware so
 * every downstream raw read sees the same signal.
 */
export function queryAbortScope(): Middleware {
  return (context, next) => runWithRequestSignal(context.request.signal, next)
}
