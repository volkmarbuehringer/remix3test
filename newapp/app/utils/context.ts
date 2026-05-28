import { getContext } from 'remix/middleware/async-context'
import type { AuthState } from 'remix/middleware/auth'

import type { User } from '../data/schema.ts'

export function getCurrentUser(): User {
  let auth = getCurrentAuth()

  if (!auth.ok) {
    throw new Error('Expected an authenticated user. Make sure requireAuth() runs before this code.')
  }

  return auth.identity
}

export function getCurrentUserSafely(): User | null {
  let auth = getCurrentAuth()
  return auth.ok ? auth.identity : null
}

function getCurrentAuth(): AuthState<User> {
  let auth = getContext().auth as AuthState<User> | undefined
  if (auth == null) {
    throw new Error('Auth not found in request context. Make sure auth() middleware runs first.')
  }
  return auth
}
