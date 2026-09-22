import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session-storage/fs'
import { createMemorySessionStorage } from 'remix/session-storage/memory'

const appRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sessionDirectoryPath = path.join(appRootPath, '..', 'tmp', 'sessions')

// Tests run many worker processes against one checkout. The fs store writes a
// session file non-atomically, and a reader that catches the truncated file
// fails JSON.parse ("Unexpected end of JSON input") and silently loses the
// session — observed as a logged-out uploads grid under parallel load. Test
// workers are separate processes that share module state with their in-process
// test server, so an in-memory store is both per-worker-isolated and race-free.
const isTest = process.env.NODE_ENV === 'test'

if (!isTest) {
  fs.mkdirSync(sessionDirectoryPath, { recursive: true })
}

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required. Set it in .env')
}

export const sessionCookie = createCookie('session', {
  secrets: [sessionSecret],
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'Strict',
  maxAge: 2592000,
  path: '/',
})

export const sessionStorage = isTest
  ? createMemorySessionStorage()
  : createFsSessionStorage(sessionDirectoryPath)

/**
 * Serialize a raw session id into the cookie value the session middleware
 * expects when the cookie has a configured lifetime (`maxAge`/`expires`).
 *
 * The middleware wraps the stored id as `{ value, expires }` before signing;
 * callers that bypass the middleware (tests) must do the same or the cookie is
 * treated as expired and a fresh session is started.
 */
export async function serializeSessionCookie(sessionId: string): Promise<string> {
  let maxAge = sessionCookie.maxAge
  let expires = maxAge == null ? undefined : Date.now() + maxAge * 1000
  let value = expires == null ? sessionId : JSON.stringify({ value: sessionId, expires })
  return sessionCookie.serialize(value)
}

/**
 * Read the raw session id from a session cookie header, unwrapping the lifetime
 * envelope added by the session middleware.
 */
export async function readSessionId(cookieHeader: string | null): Promise<string | null> {
  let value = await sessionCookie.parse(cookieHeader)
  if (value == null) return null

  try {
    let data: unknown = JSON.parse(value)
    if (data != null && typeof data === 'object' && 'value' in data) {
      let wrapped = (data as { value: unknown }).value
      if (typeof wrapped === 'string') return wrapped
    }
  } catch {
    // Cookies issued without a lifetime envelope carry the id directly.
  }

  return value
}
