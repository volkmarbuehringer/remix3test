import { createAction } from 'remix/router'
import { Database } from 'remix/data-table'

import { routes } from '../../../routes.ts'
import { hashToken } from '../../../utils/api-token.ts'
import { parseBearerToken } from '../../../utils/auth-header.ts'
import { apiTokens } from '../../../data/schema.ts'
export const apiLogout = createAction(routes.api.logout, {
  middleware: [],

  async handler(context) {
    let token = parseBearerToken(context.request)
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let db = context.get(Database)
    if (!db) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 })
    }

    let tokenHash = hashToken(token)
    let apiToken = await db.findOne(apiTokens, { where: { token_hash: tokenHash } })

    if (!apiToken || apiToken.revoked_at !== null || apiToken.expires_at < Date.now()) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await db.update(apiTokens, apiToken.id, { revoked_at: Date.now() })

    return Response.json({ success: true })
  },
})
