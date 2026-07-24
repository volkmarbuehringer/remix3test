import { createAction } from 'remix/router'
import { Database, DataTableConstraintError } from 'remix/data-table'
import * as s from 'remix/data-schema'

import { routes } from '../../../routes.ts'
import { users, apiTokens } from '../../../data/schema.ts'
import { verifyPassword } from '../../../utils/password-hash.ts'
import { generateApiToken, hashToken, computeTokenExpiry } from '../../../utils/api-token.ts'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { sourceIp } from '../../../utils/request-ip.ts'
// Rate limiters are in-memory per-process. In multi-instance deployments,
// each instance has independent state. Use a shared store (Redis, PostgreSQL)
// if horizontal scaling is needed.
const emailLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 10 })
const ipLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 20 })

const loginSchema = s.object({
  email: s.string(),
  password: s.string(),
})

export const apiLogin = createAction(routes.api.login, {
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

    let ip = sourceIp(context.request)
    if (ip && !ipLimiter.attempt(ip)) {
      return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    let db = context.get(Database)
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

    if (user.email_verified === 0) {
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
      if (err instanceof DataTableConstraintError) {
        // Hash collision (astronomically unlikely), retry with a new token
        let retryToken = generateApiToken()
        let retryHash = hashToken(retryToken)
        await db.create(apiTokens, {
          user_id: user.id,
          token_hash: retryHash,
          expires_at: computeTokenExpiry(),
        })
        return Response.json({ token: retryToken })
      }
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    return Response.json({ token })
  },
})
