import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session-storage/fs'
import { createMemorySessionStorage } from 'remix/session-storage/memory'

import { envPositiveNumber, isProduction, isTest, requireEnv } from '../config.ts'
import { pruneSessionFiles, resolveSessionDirectory } from '../utils/session-files.ts'
import { mergeSessionWrites } from '../utils/session-storage-merge.ts'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const appRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sessionDirectoryPath = resolveSessionDirectory(
  process.env.SESSION_DIR,
  path.join(appRootPath, '..', 'tmp', 'sessions'),
)

/** Files untouched for this long are swept at boot and hourly (default: 60 days). */
const sessionRetentionMs = envPositiveNumber('SESSION_RETENTION_MS', 60 * DAY_MS)
const sessionMaintenanceIntervalMs = envPositiveNumber('SESSION_MAINTENANCE_INTERVAL_MS', HOUR_MS)

// Tests run many worker processes against one checkout. A per-worker in-memory
// store keeps them from sharing session files (or state left by earlier runs)
// in the session directory. Non-test runs use the fs store, which saves by writing a
// temporary file and renaming it over the session file (remix #12148), so an
// overlapping read cannot observe a partially written session.
if (!isTest) {
  fs.mkdirSync(sessionDirectoryPath, { recursive: true })
}

const sessionSecret = requireEnv('SESSION_SECRET')

export const sessionCookie = createCookie('session', {
  secrets: [sessionSecret],
  secure: isProduction,
  httpOnly: true,
  sameSite: 'Strict',
  maxAge: 2592000,
  path: '/',
})

// A request reads its session before the handler and saves it afterwards, so two
// overlapping requests would otherwise overwrite each other's changes. The
// decorator re-applies this request's keys on the stored session at save time.
export const sessionStorage = mergeSessionWrites(
  isTest ? createMemorySessionStorage() : createFsSessionStorage(sessionDirectoryPath),
  { flashKeys: ['success', 'error'] },
)

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

let sessionMaintenanceTimer: ReturnType<typeof setInterval> | undefined

/**
 * Sweep abandoned session files at boot and hourly. Same shape as the database
 * retention sweep: failures are logged, never propagated, and the timer is
 * unref'd so it cannot keep the process alive.
 */
export function startSessionMaintenance(): void {
  if (isTest || sessionMaintenanceTimer !== undefined) return

  let sweep = (): void => {
    void pruneSessionFiles(sessionDirectoryPath, { retentionMs: sessionRetentionMs })
      .then(({ sessions, temporary }) => {
        if (sessions || temporary) {
          console.log(
            `Session maintenance: removed ${sessions} session files and ${temporary} temp files`,
          )
        }
      })
      .catch((error: unknown) => {
        console.error('session retention cleanup failed:', error)
      })
  }

  sweep()
  sessionMaintenanceTimer = setInterval(sweep, sessionMaintenanceIntervalMs)
  sessionMaintenanceTimer.unref?.()
}

export function stopSessionMaintenance(): void {
  if (sessionMaintenanceTimer === undefined) return
  clearInterval(sessionMaintenanceTimer)
  sessionMaintenanceTimer = undefined
}
