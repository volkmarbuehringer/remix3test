import type { Middleware } from 'remix/router'

import { createRateLimiter } from '../utils/rate-limiter.ts'

export function globalRateLimit(options?: {
  maxPerWindow?: number
  windowMs?: number
  trustProxy?: boolean
}): Middleware {
  let maxPerWindow = options?.maxPerWindow ?? 500
  let windowMs = options?.windowMs ?? 60_000
  let trustProxy = options?.trustProxy ?? false
  let limiter = createRateLimiter({ windowMs, perKey: true, maxAttempts: maxPerWindow })

  return async (context, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next()
    }

    if (context.url.pathname.startsWith('/assets/')) {
      return next()
    }

    let ip: string
    if (trustProxy) {
      ip =
        context.request.headers.get('Cf-Connecting-Ip') ??
        context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
        context.request.headers.get('X-Real-Ip') ??
        'unknown'
    } else {
      ip = 'unknown'
    }

    let check = limiter.check(ip)
    if (!check.allowed) {
      console.warn(
        JSON.stringify({
          event: 'rate_limit.exceeded',
          ip,
          path: context.url.pathname,
          retryAfter: check.retryAfter,
        }),
      )
      return new Response('Too Many Requests', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'Retry-After': String(check.retryAfter ?? Math.ceil(windowMs / 1000)),
          'Content-Type': 'text/plain; charset=utf-8',
          'Ratelimit-Limit': String(maxPerWindow),
          'Ratelimit-Remaining': '0',
          'Ratelimit-Reset': String(check.retryAfter ?? Math.ceil(windowMs / 1000)),
        },
      })
    }

    limiter.set(ip)

    let response = await next()
    let headers = new Headers(response.headers)
    let s = limiter.state(ip)
    if (s) {
      headers.set('Ratelimit-Limit', String(maxPerWindow))
      headers.set('Ratelimit-Remaining', String(s.remaining))
      headers.set('Ratelimit-Reset', String(s.reset))
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
