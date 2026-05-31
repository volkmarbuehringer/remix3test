import type { Middleware } from 'remix/router'

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' ws://localhost:44100 wss: https://opencode.ai",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "base-uri 'self'",
].join('; ')

export function securityHeaders(): Middleware {
  return async (context, next) => {
    let response = await next()
    let headers = new Headers(response.headers)

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
      headers.set('Content-Security-Policy', CSP_POLICY)
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
