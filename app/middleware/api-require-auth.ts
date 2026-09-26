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

/**
 * Like {@link requireApiAuth}, but also requires the token's user to be an
 * admin. Used by the system webhook endpoints: a plain customer token must not
 * be able to write into the admin webhook inbox or make the server forward
 * attacker-controlled payloads to the internal Hermes service.
 */
export function requireApiAdmin(): Middleware {
  return async (context, next) => {
    let apiUser = context.get(ApiUser)

    if (!apiUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (apiUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    return next()
  }
}
