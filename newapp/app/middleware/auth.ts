import { createCredentialsAuthProvider } from 'remix/auth'
import {
  auth,
  Auth,
  requireAuth as requireAuthenticatedUser,
  createSessionAuthScheme,
} from 'remix/middleware/auth'
import { Database } from 'remix/data-table'
import { html } from 'remix/html-template'
import { routes } from '../routes.ts'

import { users } from '../data/schema.ts'
import type { User } from '../data/schema.ts'
import { verifyPassword } from '../utils/password-hash.ts'
import { parseId } from '../utils/ids.ts'
import { getSafeReturnTo } from '../utils/redirect.ts'

interface AppAuthSession {
  userId: number
}

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, AppAuthSession>({
        read(session) {
          return parseAppAuthSession(session.get('auth'))
        },
        async verify(value, context) {
          let db = context.get(Database)
          if (db == null) {
            throw new Error('Expected database middleware before session auth scheme')
          }
          return (await db.find(users, value.userId)) ?? null
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

export const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let formData = context.get(FormData)
    if (formData == null) {
      throw new Error('Expected formData() middleware before password auth provider')
    }

    return {
      email: normalizeEmail(formData.get('email')?.toString() ?? ''),
      password: formData.get('password')?.toString() ?? '',
    }
  },
  async verify({ email, password }, context) {
    let db = context.get(Database)
    if (db == null) {
      throw new Error('Expected database middleware before password auth provider')
    }
    let user = await db.findOne(users, { where: { email } })

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return null
    }

    return user
  },
})

export function requireAuth(options?: { redirectTo?: string }) {
  let redirectTo = options?.redirectTo ?? routes.auth.login.index.href()

  return requireAuthenticatedUser({
    onFailure(context) {
      let isFrameRequest = context.request.headers.get('X-Remix-Frame') === 'true'

      if (isFrameRequest) {
        return new Response(
          String(html`<div><h1>Not authorized</h1><p>Refresh the page to sign in again.</p></div>`),
          {
            status: 401,
            headers: {
              'Content-Type': 'text/html; charset=UTF-8',
            },
          },
        )
      }

      let returnTo =
        getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? context.url.pathname
      let location = returnTo
        ? `${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`
        : redirectTo
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      })
    },
  })
}

function parseAppAuthSession(value: unknown): AppAuthSession | null {
  if (typeof value !== 'object' || value == null) return null

  let userId = parseId((value as { userId?: unknown }).userId)
  if (userId == null) return null

  return { userId }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}


