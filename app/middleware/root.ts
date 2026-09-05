import type { Cookie } from 'remix/cookie'
import { createMiddleware, type Middleware } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'

import { uploadFormData } from './uploads.ts'
import { uploadClaimScope } from './upload-claim.ts'
import { logger, Logger, type LoggerFunction } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { session } from 'remix/middleware/session'
import type { SessionStorage } from 'remix/session'

import { globalRateLimit } from './global-rate-limit.ts'
import { skipCsrf } from './skip-csrf.ts'

import { json } from './json-render.ts'
import { jsonBody } from './json-body.ts'
import { render } from 'remix/middleware/render'
import { loadAssetEntry } from './asset-entry.ts'
import { securityHeaders } from './security-headers.ts'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'
import { mailer } from './mailer.ts'
import { frameRedirects } from './frame-redirect.ts'

import { assetServer } from '../assets.ts'

/**
 * Logs requests via the built-in logger for non-asset routes, suppresses
 * successful asset requests (status < 400), and warns on asset errors.
 */
export function skipAssetsLogger(): Middleware<{
  key: typeof Logger
  value: LoggerFunction
  property: 'logger'
}> {
  return async (context, next) => {
    if (context.url.pathname.startsWith('/assets/')) {
      context.set(Logger, console.log, { property: 'logger' })
      let response = await next()
      if (response.status >= 400) {
        context.get(Logger)?.(
          `${context.request.method} ${context.url.pathname} → ${response.status}`,
        )
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
    globalRateLimit({
      maxPerWindow: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || undefined,
    }),
    uploadClaimScope(),
    uploadFormData(),
    methodOverride(),
    jsonBody({ maxSize: 256 * 1024 }),
    session(cookie, storage),
    skipCsrf(),
    asyncContext(),
    loadDatabase(),
    loadAuth(),
    mailer(),
    loadAssetEntry(),
    render({ assets: assetServer }),
    json(),
    frameRedirects(),
  )
}
