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
      context.url.pathname === '/callback' ||
      context.url.pathname.startsWith('/api/') ||
      context.url.pathname === '/testagent' ||
      context.url.pathname.startsWith('/testagent/') ||
      context.url.pathname === '/route-agent' ||
      context.url.pathname.startsWith('/route-agent/') ||
      context.url.pathname === '/mastra/chat' ||
      context.url.pathname.startsWith('/mastra/chat/') ||
      context.url.pathname === '/workflow-agent' ||
      context.url.pathname.startsWith('/workflow-agent/') ||
      context.url.pathname === '/workflowagent2' ||
      context.url.pathname.startsWith('/workflowagent2/')
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
