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
 *
 * The deny list pins what the app does not render: no iframes or embedded
 * objects, no workers, no audio/video, no web app manifest, and no `<base>`
 * element outside a test fixture. `default-src` stays `'self'` for the fetch
 * directives that are not enumerated here.
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
    imgSrc: ["'self'"],
    connectSrc,
    mediaSrc: ["'none'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    workerSrc: ["'none'"],
    manifestSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'none'"],
  }
}

/**
 * Denies every powerful browser feature the app does not use. The list is
 * intentionally explicit: adding an undecided feature later must be a
 * deliberate policy change, not a browser default leaking through.
 */
export const permissionsPolicy = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
  'sync-xhr=()',
  'display-capture=()',
  'clipboard-read=()',
  'clipboard-write=()',
  'fullscreen=()',
  'picture-in-picture=()',
  'screen-wake-lock=()',
  'serial=()',
  'hid=()',
  'bluetooth=()',
  'local-fonts=()',
  'encrypted-media=()',
  'publickey-credentials-get=()',
  'browsing-topics=()',
].join(', ')

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
    headers.set('Permissions-Policy', permissionsPolicy)
  }
  // Same-origin isolation: the app never cooperates with cross-origin windows,
  // embeds no cross-origin resources, and has no legacy plugin/XHR surface.
  if (!headers.has('Cross-Origin-Opener-Policy')) {
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  }
  if (!headers.has('Cross-Origin-Resource-Policy')) {
    headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  }
  if (!headers.has('Origin-Agent-Cluster')) {
    headers.set('Origin-Agent-Cluster', '?1')
  }
  if (!headers.has('X-Permitted-Cross-Domain-Policies')) {
    headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  }
  if (!headers.has('X-DNS-Prefetch-Control')) {
    headers.set('X-DNS-Prefetch-Control', 'off')
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

    // `frameRedirects()` re-enters the middleware stack to follow an in-frame
    // PRG, so its fragment passes through `csp()` twice (inner + enclosing) and
    // both append this document's policy with the same inherited nonce. The two
    // policies are identical, and browsers enforce each one separately, so
    // collapse the repetition into one.
    collapseDuplicatePolicies(headers, 'Content-Security-Policy')

    // Every cache policy is per-request: HTML carries the CSP nonce, and error
    // responses are request-specific (the router's default 404, thrown-route
    // 500s). Never let a shared cache reuse either. Routes that knowingly
    // return a cacheable/streaming body (/health, uploads, SSE) set their own
    // `Cache-Control` first and are left untouched.
    if (!headers.has('Cache-Control')) {
      if (isHtmlContentType(headers)) {
        // `no-store` (not just `no-cache`) keeps the nonce-bearing document out
        // of shared caches entirely; `private` documents browser-only caching
        // as an additional signal for any intermediary that only honors it.
        headers.set('Cache-Control', 'private, no-store')
      } else if (response.status >= 400) {
        headers.set('Cache-Control', 'no-store')
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/** Matches `text/html` regardless of charset/parameter casing. */
function isHtmlContentType(headers: Headers): boolean {
  return headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/html'
}

/**
 * Collapses a header whose serialized value repeats one identical entry.
 *
 * CSP serializes as a comma-separated list of independent policies, and this
 * app's policy contains no comma at all, so a value that splits into the same
 * string more than once is the inner/outer `csp()` duplicate from an in-frame
 * PRG follow. Anything else is left untouched.
 */
function collapseDuplicatePolicies(headers: Headers, name: string): void {
  let value = headers.get(name)
  if (!value) return

  let policies = value.split(', ')
  if (policies.length < 2) return
  let [first] = policies
  if (policies.every((policy) => policy === first)) {
    headers.set(name, first!)
  }
}
