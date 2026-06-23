import type { Middleware } from 'remix/router'
import { Auth } from 'remix/middleware/auth'

export function requireSseAuth(): Middleware {
  return async (context, next) => {
    let auth = context.get(Auth)
    if (!auth || !auth.ok || !auth.identity) {
      return new Response('Unauthorized', { status: 401 })
    }
    return next()
  }
}
