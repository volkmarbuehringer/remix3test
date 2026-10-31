import type { Cookie } from 'remix/cookie'
import { createMiddleware, type Middleware } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'

import { uploadFormData } from './uploads.ts'
import { uploadFilesScope } from './upload-files.ts'
import { envPositiveNumberOrUndefined } from '../config.ts'
import { uploadClaimScope } from './upload-claim.ts'
import { logger, Logger, type LoggerFunction } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'
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
    // Root-served static files (self-hosted fonts under `public/`). Runs after
    // `securityHeaders()` so static responses still get the CSP, and before the
    // session/database stack so a font request never touches them.
    // compression() above wraps static responses per the request-handling guide
    // (put a response wrapper before an early response it should transform);
    // its own guards skip the .woff2 files (already-compressed MIME filter),
    // while `fonts.css` benefits from compression.
    staticFiles('./public', {
      // `/` must reach the home route instead of looking for public/index.html.
      index: false,
      // No content hash in these URLs, so keep a bounded TTL instead of immutable.
      cacheControl: 'public, max-age=86400',
    }),
    globalRateLimit({
      maxPerWindow: envPositiveNumberOrUndefined('GLOBAL_RATE_LIMIT_MAX'),
    }),
    // Must run OUTSIDE session(): a PRG follow re-fetches the redirect
    // destination as a new request, and the session middleware only persists
    // the flash when the outer response unwinds. Outside it, the flash is
    // already stored when the follow re-enters the stack, so the destination
    // fragment can read (and clear) it. Inside it, the follow would read the
    // pre-redirect session and silently drop every in-frame PRG message.
    frameRedirects(),
    // Auth and request context run before the multipart parser so
    // uploadFormData() can reject unauthenticated multipart requests before a
    // single byte is parsed or stored. The parser still runs before route-level
    // requireAuth(), so upload ownership is claimed in the action afterwards.
    session(cookie, storage),
    asyncContext(),
    loadDatabase(),
    loadAuth(),
    mailer(),
    uploadClaimScope(),
    // Per-request scope for the filesystem streaming handler (see
    // app/middleware/upload-files.ts). Must run before uploadFormData() so the
    // handler can record its server-generated storage keys.
    uploadFilesScope(),
    uploadFormData(),
    methodOverride(),
    jsonBody({ maxSize: 256 * 1024 }),
    skipCsrf(),
    loadAssetEntry(),
    // Guide ch. 6: the server renderer's onError is the reporting hook for
    // render errors on document and browser-initiated frame requests. The
    // middleware silences onError for its own internal frame subrequests so the
    // enclosing render reports the error exactly once.
    render({
      assets: assetServer,
      onError(error) {
        console.error(error)
      },
    }),
    json(),
  )
}
