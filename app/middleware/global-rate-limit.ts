import type { Middleware } from 'remix/router'
import { Logger } from 'remix/middleware/logger'
import { html } from 'remix/html-template'

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
      context.get(Logger)?.(JSON.stringify({
        event: 'rate_limit.exceeded',
        ip,
        path: context.url.pathname,
        retryAfter: check.retryAfter,
      }))
      let retryAfter = check.retryAfter ?? Math.ceil(windowMs / 1000)
      return new Response(
        String(html`<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Zu viele Anfragen — newapp</title>
<style>
  body { font-family: 'JetBrains Mono', ui-monospace, monospace; background: #f7fbff; color: #313539; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #ffffff; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 480px; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
  p { color: #5a5e62; margin: 0 0 1rem; }
  .retry { font-size: 0.75rem; color: #94989c; }
</style></head>
<body><div class="card"><h1>Zu viele Anfragen</h1><p>Sie haben in kurzer Zeit zu viele Anfragen gesendet. Bitte warten Sie einen Moment und versuchen Sie es erneut.</p><p class="retry">Wiederholen in ${retryAfter} Sekunden</p></div></body>
</html>`),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Retry-After': String(retryAfter),
            'Content-Type': 'text/html; charset=utf-8',
            'Ratelimit-Limit': String(maxPerWindow),
            'Ratelimit-Remaining': '0',
            'Ratelimit-Reset': String(retryAfter),
          },
        },
      )
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
