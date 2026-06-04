import { createAction } from 'remix/router'
import { getContext } from 'remix/middleware/async-context'

import { routes } from '../../routes.ts'

export const authLogout = createAction(routes.auth.logout, () => {
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
