import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'

const cspNonceKey = createContextKey<string>()

export function getCspNonce(): string | undefined {
  try {
    return getContext().get(cspNonceKey)
  } catch {
    return undefined
  }
}

export function securityHeaders(): Middleware {
  return async (context, next) => {
    let nonce = crypto.randomUUID()
    context.set(cspNonceKey, nonce)

    let response = await next()
    let headers = new Headers(response.headers)

    let csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `connect-src 'self' ws://localhost:44100 wss: https://opencode.ai`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `img-src 'self' data:`,
      `base-uri 'self'`,
    ].join('; ')

    if (!headers.has('X-Content-Type-Options')) {
      headers.set('X-Content-Type-Options', 'nosniff')
    }
    if (!headers.has('X-Frame-Options')) {
      headers.set('X-Frame-Options', 'DENY')
    }
    if (!headers.has('Referrer-Policy')) {
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    }
    if (!headers.has('Content-Security-Policy')) {
      headers.set('Content-Security-Policy', csp)
    }
    if (!headers.has('Permissions-Policy')) {
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    }

    if (process.env.NODE_ENV === 'production' && !headers.has('Strict-Transport-Security')) {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
