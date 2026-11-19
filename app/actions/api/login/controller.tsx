import { createAction } from 'remix/router'
import * as s from 'remix/data-schema'
import type { Database } from 'remix/data-table'

import { databaseContext } from '../../../middleware/database.ts'
import { routes } from '../../../routes.ts'
import { users, apiTokens } from '../../../data/schema.ts'
import { verifyPassword } from '../../../utils/password-hash.ts'
import { generateApiToken, hashToken, computeTokenExpiry } from '../../../utils/api-token.ts'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginFailures,
} from '../../../utils/login-rate-limit.ts'
import { connectionIp } from '../../../utils/request-ip.ts'
import { isUniqueViolation } from '../../../utils/db-errors.ts'
import { logSecurityEvent } from '../../../data/security-events.ts'

const loginSchema = s.object({
  email: s.string(),
  password: s.string(),
})

/**
 * M5: a fixed, valid-format PBKDF2 hash used to verify the password even when
 * the account does not exist. Without it the unknown-email path short-circuits
 * before PBKDF2 and returns measurably faster, turning response time into an
 * account-enumeration oracle. The hash is of a throwaway value and is not a
 * secret; verifying against it costs the same ~100 ms as a real verification.
 */
const DUMMY_PASSWORD_HASH =
  'pbkdf2_sha256$100000$PdR0eMwis-Yuw7XZBqv8Qg$Yy8HZ75Z31HcFgLvocnrDKsq4kaFkoWyRma2-puUcrs'

/**
 * True when a token insert failed because `api_tokens.token_hash` already
 * exists. The driver wraps PostgreSQL errors in `DataTableDatabaseError`, so
 * the real code (`23505`) lives on `.cause`; checking
 * `instanceof DataTableConstraintError` never matches. Exported for the
 * regression test in login.test.ts.
 */
export function isTokenHashCollision(error: unknown): boolean {
  return isUniqueViolation(error)
}

export default createAction(routes.api.login, {
  middleware: [],

  async handler(context) {
    let body = context.jsonBody
    if (!body) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    let parsed = s.parseSafe(loginSchema, body)
    if (!parsed.success) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }

    let email = parsed.value.email.trim().toLowerCase()
    let password = parsed.value.password

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // The server boundary always stamps X-Client-Ip from the TCP socket; the
    // 'unknown' fallback only catches internal re-entries that skip the
    // boundary (shared bucket — fails toward lockout, never toward bypass).
    // The lockout state is shared with the browser login, so alternating
    // endpoints cannot double the guessing budget.
    let ip = connectionIp(context.request) || 'unknown'
    let block = checkLoginRateLimit(email, ip)
    if (block) {
      let dbForLock = context.get(databaseContext)
      if (dbForLock) {
        await logSecurityEvent(dbForLock, {
          event_type: 'api_login_locked',
          email,
          ip,
          details: { reason: block.reason },
        })
      }
      return Response.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(block.retryAfterSeconds) } },
      )
    }

    let db = context.get(databaseContext)
    if (!db) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    let user = await db.findOne(users, { where: { email } })

    if (!user) {
      // M5: spend the same PBKDF2 time as a real verification so response time
      // does not reveal whether the account exists.
      await verifyPassword(password, DUMMY_PASSWORD_HASH)
      recordLoginFailure(email, ip)
      await logSecurityEvent(db, { event_type: 'api_login_failed', email, ip })
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    let valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      recordLoginFailure(email, ip)
      await logSecurityEvent(db, {
        event_type: 'api_login_failed',
        user_id: user.id,
        email,
        ip,
      })
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (user.email_verified !== 1) {
      recordLoginFailure(email, ip)
      await logSecurityEvent(db, {
        event_type: 'api_login_failed',
        user_id: user.id,
        email,
        ip,
        details: { reason: 'email_not_verified' },
      })
      return Response.json({ error: 'Email not verified' }, { status: 403 })
    }

    // Only failures consume the budget; a successful login clears the
    // per-account failure state (matching the browser login).
    resetLoginFailures(email)

    let token = generateApiToken()
    let tokenHash = hashToken(token)

    try {
      await db.create(apiTokens, {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: computeTokenExpiry(),
      })
    } catch (err) {
      if (isTokenHashCollision(err)) {
        // Hash collision (astronomically unlikely), retry with a new token.
        // A failed retry keeps the handler's 503 contract instead of escaping
        // as an unhandled 500.
        try {
          let retryToken = generateApiToken()
          let retryHash = hashToken(retryToken)
          await db.create(apiTokens, {
            user_id: user.id,
            token_hash: retryHash,
            expires_at: computeTokenExpiry(),
          })
          await logApiLoginSuccess(db, user.id, email, ip)
          return Response.json({ token: retryToken })
        } catch {
          return Response.json({ error: 'Service unavailable' }, { status: 503 })
        }
      }
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    await logApiLoginSuccess(db, user.id, email, ip)
    return Response.json({ token })
  },
})

/** Record a successful API login and the bearer-token issuance it produces. */
async function logApiLoginSuccess(
  db: Database,
  userId: number,
  email: string,
  ip: string,
): Promise<void> {
  await logSecurityEvent(db, { event_type: 'api_login_success', user_id: userId, email, ip })
  await logSecurityEvent(db, { event_type: 'api_token_issued', user_id: userId, email, ip })
}
