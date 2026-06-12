import type { Cookie } from 'remix/cookie'
import { createMiddleware, type Middleware } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { uploadHandler } from './uploads.ts'
import { logger, Logger } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { session } from 'remix/middleware/session'
import type { SessionStorage } from 'remix/session'

import { globalRateLimit } from './global-rate-limit.ts'
import { json } from './json-render.ts'
import { render } from './render.tsx'
import { loadAssetEntry } from './asset-entry.ts'
import { securityHeaders } from './security-headers.ts'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'
import { mailer } from './mailer.ts'

/**
 * Logs requests via the built-in logger for non-asset routes, suppresses
 * successful asset requests (status < 400), and warns on asset errors.
 */
export function skipAssetsLogger(): Middleware {
  return async (context, next) => {
    if (context.url.pathname.startsWith('/assets/')) {
      context.set(Logger, console.log, { property: 'logger' })
      let response = await next()
      if (response.status >= 400) {
        context.get(Logger)?.(`${context.request.method} ${context.url.pathname} → ${response.status}`)
      }
      return response
    }
    return logger({ format: '[%date] %method %path → %status (%duration)' })(context, next)
  }
}

export function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(
    skipAssetsLogger(),
    securityHeaders(),
    compression(),
    globalRateLimit({ maxPerWindow: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || undefined }),
    formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),
    methodOverride(),
    session(cookie, storage),
    csrf(),
    asyncContext(),
    loadDatabase(),
    loadAuth(),
    mailer(),
    loadAssetEntry(),
    render(),
    json(),
  )
}
