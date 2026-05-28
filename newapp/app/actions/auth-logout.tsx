import { createAction } from 'remix/router'

import type { AppContext } from '../types/context.ts'
import { getContext } from 'remix/middleware/async-context'
import { routes, authRoutes } from '../routes.ts'

export const authLogout = createAction<typeof authRoutes.authLogout, AppContext>(authRoutes.authLogout, () => {
  let session = getContext().session
  if (session == null) {
    throw new Error('Expected session() middleware before auth logout')
  }
  session.unset('auth')
  session.regenerateId(true)
  return new Response(null, {
    status: 302,
    headers: { Location: routes.home.href() },
  })
})
