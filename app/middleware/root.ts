import type { Cookie } from 'remix/cookie'
import { createMiddleware } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { session } from 'remix/middleware/session'
import type { SessionStorage } from 'remix/session'

import { json } from './json-render.ts'
import { render } from './render.tsx'
import { loadAssetEntry } from './asset-entry.ts'
import { securityHeaders } from './security-headers.ts'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'
import { mailer } from './mailer.ts'

export function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(
    logger({ format: '[%date] %method %path → %status (%duration)' }),
    securityHeaders(),
    compression(),
    formData(),
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
