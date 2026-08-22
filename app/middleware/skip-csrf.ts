import type { Middleware } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'

const csrfMiddleware = csrf({
  origin: (origin, context) =>
    /\.trycloudflare\.com$/.test(origin) || origin === context.url.origin,
})

// Session-cookie-authenticated browser endpoints that skip CSRF (SSE/agent
// streams call fetch() and cannot embed a form token). Skipping CSRF opens
// them to cross-site <form> attacks, so require a custom header that a
// cross-site form cannot set (see remix-security-middleware learned skill).
const SSE_REQUEST_HEADER = 'X-Sse-Request'

const AGENT_PATHS = [
  '/testagent',
  '/route-agent',
  '/admin/support-agent',
  '/admin/workflow-agent',
  '/admin/workflowagent2',
]

function isAgentPath(pathname: string): boolean {
  return AGENT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Server-to-server / token-authenticated endpoints that must stay CSRF-free
// without a browser header (external callers cannot set X-SSE-Request).
function isExternalPath(pathname: string): boolean {
  return (
    pathname === '/webhook' ||
    pathname === '/app-webhook' ||
    pathname === '/callback' ||
    pathname.startsWith('/api/')
  )
}

export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (isExternalPath(context.url.pathname)) {
      return next()
    }

    if (isAgentPath(context.url.pathname)) {
      // Block cross-site <form> POSTs: forms cannot set custom headers.
      // GET requests (page loads, EventSource streams) are read-only and
      // carry no CSRF risk, so they pass through.
      if (
        context.request.method !== 'GET' &&
        context.request.headers.get(SSE_REQUEST_HEADER) !== '1'
      ) {
        return new Response('Forbidden', { status: 403 })
      }
      return next()
    }

    return csrfMiddleware(context, next)
  }
}
