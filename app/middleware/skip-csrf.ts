import type { Middleware } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'

const csrfMiddleware = csrf({
  origin: (origin, context) =>
    /\.trycloudflare\.com$/.test(origin) || origin === context.url.origin,
})

export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (
      context.url.pathname.startsWith('/webhook/') ||
      context.url.pathname.startsWith('/app-webhook/') ||
      context.url.pathname === '/callback' ||
      context.url.pathname === '/webhook-requests/events'
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
