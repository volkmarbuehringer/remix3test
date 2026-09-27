import type { Middleware } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'

import type { User } from '../data/schema.ts'

/**
 * Admin-only SSE auth. EventSource clients cannot act on the redirect/HTML
 * responses that requireAdmin produces, so this returns plain 401/403 statuses
 * the connection indicator can treat as a failed stream.
 */
export function requireAdminSseAuth(): Middleware {
  return async (context, next) => {
    let auth = context.get(Auth) as AuthState<User> | undefined
    if (!auth || !auth.ok || !auth.identity) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (auth.identity.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }
    return next()
  }
}
