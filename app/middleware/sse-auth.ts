import type { Middleware } from 'remix/router'

import { getAuthState } from '../utils/context.ts'

/**
 * Admin-only SSE auth. EventSource clients cannot act on the redirect/HTML
 * responses that requireAdmin produces, so this returns plain 401/403 statuses
 * the connection indicator can treat as a failed stream.
 */
export function requireAdminSseAuth(): Middleware {
  return async (context, next) => {
    let auth = getAuthState(context)
    if (!auth || !auth.ok || !auth.identity) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (auth.identity.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }
    return next()
  }
}
