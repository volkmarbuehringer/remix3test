import { createContextKey, type Middleware } from 'remix/router'
import { Database } from 'remix/data-table'

import { hashToken } from '../utils/api-token.ts'
import { parseBearerToken } from '../utils/auth-header.ts'
import { apiTokens, users } from '../data/schema.ts'
import type { User } from '../data/schema.ts'

export const ApiUser = createContextKey<User>()

export function apiTokenAuth(): Middleware {
  return async (context, next) => {
    let token = parseBearerToken(context.request)
    if (!token) {
      return next()
    }

    let db = context.get(Database)
    if (!db) {
      return next()
    }

    let tokenHash = hashToken(token)
    let apiToken = await db.findOne(apiTokens, { where: { token_hash: tokenHash } })

    if (apiToken && apiToken.revoked_at !== null) {
      return Response.json({ error: 'Token revoked' }, { status: 401 })
    }

    if (apiToken && apiToken.expires_at < Date.now()) {
      return Response.json({ error: 'Token expired' }, { status: 401 })
    }

    if (apiToken) {
      let user = await db.findOne(users, { where: { id: apiToken.user_id } })
      if (user) {
        context.set(ApiUser, user, { property: 'apiUser' })
        return next()
      }
    }

    return next()
  }
}
