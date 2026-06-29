import type { Middleware } from 'remix/router'

import { ApiUser } from './api-token-auth.ts'

export function requireApiAuth(): Middleware {
  return async (context, next) => {
    let apiUser = context.get(ApiUser)

    if (apiUser) {
      return next()
    }

    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
