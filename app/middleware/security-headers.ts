import type { Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import { getCspNonce as getRequestCspNonce } from 'remix/middleware/csp'
import { SuperHeaders, type ContentSecurityPolicyInit } from 'remix/headers'

import { isProduction } from '../config.ts'

/**
 * Reads the nonce established by the vendor `csp()` middleware.
 *
 * Components render inside the request's async context, so the wrapper keeps
 * authored inline scripts from having to thread the request context through
 * every call site. Outside a request it returns undefined, matching the old
 * local helper.
 */
export function getCspNonce(): string | undefined {
  try {
    return getRequestCspNonce(getContext())
  } catch {
    return undefined
  }
}

/**
 * Policy for `remix/middleware/csp`.
 *
 * `script-src` stays nonce-based. Styles are split so modern browsers gate
 * `<style>` elements with the request nonce while inline `style="…"` attributes
 * keep working: `style-src-elem` carries `'self'` + the nonce, and
 * `style-src-attr` keeps `'unsafe-inline'`. `style-src` remains the
 * `'unsafe-inline'` fallback for browsers without the split directives.
 *
 * The HMR websocket is only needed inside the node-HMR child, which sets
 * `REMIX_NODE_HMR=1`. Plain `npm run dev` has no HMR websocket, so the source
 * must not be allowed merely because `NODE_ENV=development`.
 *
 * `connect-src` stays first-party: all AI traffic is server-side
 * (`app/utils/ai-provider.ts` and `app/actions/mastra/*`), so the browser never
 * talks to the AI provider origin and it must not appear in the policy.
 */
export function contentSecurityPolicy({ nonce }: { nonce: string }): ContentSecurityPolicyInit {
  let connectSrc = ["'self'"]
  if (process.env.REMIX_NODE_HMR === '1') {
    connectSrc.push('ws://localhost:44100')
  }

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", `'nonce-${nonce}'`, 'blob:'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    styleSrcElem: ["'self'", `'nonce-${nonce}'`],
    styleSrcAttr: ["'unsafe-inline'"],
    fontSrc: ["'self'"],
    connectSrc,
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    baseUri: ["'self'"],
  }
}

/**
 * Non-CSP hardening headers applied to every response: middleware responses and
 * responses built outside the middleware chain (the 500 page) share this.
 *
 * CSP and the request nonce come from `csp()` in `app/middleware/root.ts`;
 * keeping them out of this helper avoids a second policy/nonce source.
 */
export function applyHardeningHeaders(headers: Headers): void {
  if (!headers.has('X-Content-Type-Options')) {
    headers.set('X-Content-Type-Options', 'nosniff')
  }
  if (!headers.has('X-Frame-Options')) {
    headers.set('X-Frame-Options', 'DENY')
  }
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }
  if (!headers.has('Permissions-Policy')) {
    headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), sync-xhr=(), display-capture=()',
    )
  }

  if (isProduction && !headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

/**
 * Policy for the runtime 500 page.
 *
 * `renderServerError()` is returned straight from the server entrypoints'
 * `onError`, outside the middleware chain, so there is no request nonce to gate
 * the page's authored `<style>` with. The page is script-less, so a static
 * `style-src 'unsafe-inline'` is acceptable here and only here; anything the
 * router renders keeps the nonce-gated policy from `contentSecurityPolicy()`.
 */
export const serverErrorContentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"

export function securityHeaders(): Middleware {
  return async (_context, next) => {
    let response = await next()
    let headers = new SuperHeaders(response.headers)

    applyHardeningHeaders(headers)

    // Error responses (the router's default 404, thrown-route 500s) must never
    // be cached: they are request-specific and can hide a recovered route.
    if (response.status >= 400 && !headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-store')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
