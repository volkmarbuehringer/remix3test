import type { Middleware } from 'remix/router'
import { csrf } from 'remix/middleware/csrf'

import { configuredPublicOrigin } from '../utils/public-origin.ts'

// Cloudflare quick-tunnel hostnames are `<random-words>.trycloudflare.com`.
const TRYCLOUDFLARE_ORIGIN = /^https?:\/\/[a-z0-9-]+\.trycloudflare\.com$/i

/**
 * Whether an unsafe request's `Origin` may be trusted.
 *
 *  1. Same origin as the request URL.
 *  2. The server-configured trusted origin (`PUBLIC_ORIGIN` / the origin file).
 *     This is needed because Cloudflare quick tunnels rewrite `Host` to the
 *     origin service, so the browser `Origin` (the tunnel hostname) differs from
 *     `context.url.origin` (localhost). It also replaces the old blanket
 *     `*.trycloudflare.com` allowance with a precise, server-controlled match.
 *  3. A `*.trycloudflare.com` origin, but only for genuine same-origin browser
 *     requests. `Sec-Fetch-Site` is set by the browser and cannot be forged by a
 *     page, so an attacker-hosted tunnel (`cross-site`/`same-site`) no longer
 *     passes the origin check.
 *
 * The CSRF token is still validated after this check; this only restores the
 * origin layer as defense in depth.
 */
export function isAllowedCsrfOrigin(
  origin: string,
  context: { url: URL; request: Request },
): boolean {
  if (origin === context.url.origin) return true

  let configured = configuredPublicOrigin()
  if (configured != null && origin === configured) return true

  if (!TRYCLOUDFLARE_ORIGIN.test(origin)) return false

  let fetchSite = context.request.headers.get('Sec-Fetch-Site')
  return fetchSite === 'same-origin' || fetchSite === 'none'
}

const csrfMiddleware = csrf({ origin: isAllowedCsrfOrigin })

// Session-cookie-authenticated browser endpoints that normally skip CSRF
// (SSE/agent streams call fetch() and cannot embed a form token). A custom
// header a cross-site form cannot set keeps the fetch transport CSRF-free;
// a token-bearing native form falls through to the regular csrf() check (see
// the `security-gotchas` `references/security-middleware.md` learned skill).
const SSE_REQUEST_HEADER = 'X-Sse-Request'

const AGENT_PATHS = ['/admin/support-agent', '/admin/agent-events', '/chat']

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
      // GET requests (page loads, EventSource streams) are read-only and
      // carry no CSRF risk, so they pass through.
      if (context.request.method === 'GET') return next()

      // fetch()/EventSource clients set a header a cross-site <form> cannot, so
      // the agent transport stays CSRF-free without a form token.
      if (context.request.headers.get(SSE_REQUEST_HEADER) === '1') return next()

      // A native (no-JS) form POST cannot set a header, so fall back to the
      // regular synchronizer-token check. This lets the server-rendered
      // approve/decline form (guide 09) submit without X-Sse-Request while a
      // cross-site form still fails the token or origin check.
      return csrfMiddleware(context, next)
    }

    return csrfMiddleware(context, next)
  }
}
