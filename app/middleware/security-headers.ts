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
 * Non-CSP hardening headers. CSP and the request nonce come from `csp()` in
 * `app/middleware/root.ts`; keeping them out of this middleware avoids a
 * second policy/nonce source.
 */
export function securityHeaders(): Middleware {
  return async (_context, next) => {
    let response = await next()
    let headers = new SuperHeaders(response.headers)

    if (!headers.has('X-Content-Type-Options')) {
      headers.xContentTypeOptions = 'nosniff'
    }
    if (!headers.has('X-Frame-Options')) {
      headers.xFrameOptions = 'DENY'
    }
    if (!headers.has('Referrer-Policy')) {
      headers.referrerPolicy = 'strict-origin-when-cross-origin'
    }
    if (!headers.has('Permissions-Policy')) {
      headers.permissionsPolicy =
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), sync-xhr=(), display-capture=()'
    }

    if (isProduction && !headers.has('Strict-Transport-Security')) {
      headers.strictTransportSecurity = 'max-age=31536000; includeSubDomains'
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
