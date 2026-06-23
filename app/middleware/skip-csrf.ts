import type { Middleware } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'

const csrfMiddleware = csrf({
  origin: (origin, context) =>
    /\.trycloudflare\.com$/.test(origin) || origin === context.url.origin,
})

export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (
      context.url.pathname === '/webhook' ||
      context.url.pathname === '/app-webhook' ||
      context.url.pathname === '/callback'
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
