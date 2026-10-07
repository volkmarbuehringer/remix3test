import { getContext } from 'remix/middleware/async-context'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'

import type { User } from '../data/schema.ts'

export function getCurrentUser(): User {
  let auth = getCurrentAuth()

  if (!auth.ok) {
    throw new Error(
      'Expected an authenticated user. Make sure requireAuth() runs before this code.',
    )
  }

  return auth.identity
}

export function getCurrentUserSafely(): User | null {
  let auth = getCurrentAuth()
  return auth.ok ? auth.identity : null
}

/**
 * Extract the admin user identity from an AuthState for audit logging.
 * Returns undefined if auth is not OK (unauthenticated).
 */
export function getAdminIdentity(
  auth: AuthState<User> | undefined,
): { id: number; email: string } | undefined {
  return auth?.ok ? auth.identity : undefined
}

interface AuthContextReader {
  get(key: typeof Auth): AuthState | undefined
}

/**
 * Reads the request's auth state with this app's `User` identity type.
 *
 * The vendor `Auth` context key carries an `unknown` identity, so this is the
 * single place the app narrows it to `User`.
 */
export function getAuthState(context: AuthContextReader): AuthState<User> | undefined {
  return context.get(Auth) as AuthState<User> | undefined
}

function getCurrentAuth(): AuthState<User> {
  let auth = getAuthState(getContext())
  if (auth == null) {
    throw new Error('Auth not found in request context. Make sure auth() middleware runs first.')
  }
  return auth
}
