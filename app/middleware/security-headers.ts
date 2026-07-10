import { createContextKey, type Middleware } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'
import { SuperHeaders } from 'remix/headers'

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
    let headers = new SuperHeaders(response.headers)

    let csp = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `connect-src 'self' ws://localhost:44100 https://opencode.ai`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `img-src 'self' data:`,
      `base-uri 'self'`,
    ].join('; ')

    if (!headers.has('X-Content-Type-Options')) {
      headers.xContentTypeOptions = 'nosniff'
    }
    if (!headers.has('X-Frame-Options')) {
      headers.xFrameOptions = 'DENY'
    }
    if (!headers.has('Referrer-Policy')) {
      headers.referrerPolicy = 'strict-origin-when-cross-origin'
    }
    if (!headers.has('Content-Security-Policy')) {
      headers.contentSecurityPolicy = csp
    }
    if (!headers.has('Permissions-Policy')) {
      headers.permissionsPolicy =
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), sync-xhr=(), display-capture=()'
    }

    if (process.env.NODE_ENV === 'production' && !headers.has('Strict-Transport-Security')) {
      headers.strictTransportSecurity = 'max-age=31536000; includeSubDomains'
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
