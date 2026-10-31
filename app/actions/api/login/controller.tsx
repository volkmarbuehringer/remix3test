import { createAction } from 'remix/router'
import * as s from 'remix/data-schema'

import { databaseContext } from '../../../middleware/database.ts'
import { routes } from '../../../routes.ts'
import { users, apiTokens } from '../../../data/schema.ts'
import { verifyPassword } from '../../../utils/password-hash.ts'
import { generateApiToken, hashToken, computeTokenExpiry } from '../../../utils/api-token.ts'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { connectionIp } from '../../../utils/request-ip.ts'
import { isUniqueViolation } from '../../../utils/db-errors.ts'
// Rate limiters are in-memory per-process. In multi-instance deployments,
// each instance has independent state. Use a shared store (Redis, PostgreSQL)
// if horizontal scaling is needed.
const emailLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 10 })
const ipLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 20 })

const loginSchema = s.object({
  email: s.string(),
  password: s.string(),
})

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

    if (!emailLimiter.attempt(email)) {
      return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    // The server boundary always stamps X-Client-Ip from the TCP socket; the
    // 'unknown' fallback only catches internal re-entries that skip the
    // boundary (shared bucket — fails toward lockout, never toward bypass).
    let ip = connectionIp(context.request) || 'unknown'
    if (!ipLimiter.attempt(ip)) {
      return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let db = context.get(databaseContext)
    if (!db) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    let user = await db.findOne(users, { where: { email } })

    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    let valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (user.email_verified !== 1) {
      return Response.json({ error: 'Email not verified' }, { status: 403 })
    }

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
          return Response.json({ token: retryToken })
        } catch {
          return Response.json({ error: 'Service unavailable' }, { status: 503 })
        }
      }
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    return Response.json({ token })
  },
})
