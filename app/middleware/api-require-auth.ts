import type { Middleware } from 'remix/router'

import { ApiUser } from './api-token-auth.ts'
import { parseBearerToken, constantTimeEqual } from '../utils/auth-header.ts'

export function requireApiAuth(): Middleware {
  return async (context, next) => {
    let apiUser = context.get(ApiUser)

    if (apiUser) {
      return next()
    }

    // Check WEBHOOK_TOKEN for backward compatibility
    let token = parseBearerToken(context.request)
    let webhookToken = process.env.WEBHOOK_TOKEN
    if (token && webhookToken && constantTimeEqual(token, webhookToken)) {
      return next()
    }

    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
