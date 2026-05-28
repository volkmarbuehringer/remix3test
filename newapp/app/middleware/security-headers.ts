import type { Middleware } from 'remix/router'

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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
