import type { Middleware } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'
import { Renderer } from 'remix/middleware/render'
import type { Handle, RemixNode } from 'remix/ui'
import { SuperHeaders } from 'remix/headers'

import type { User } from '../data/schema.ts'
import { getSafeReturnTo } from '../utils/redirect.ts'
import { ForbiddenPage } from '../ui/forbidden-page.tsx'
import { routes } from '../routes.ts'

export interface RequireAdminOptions {
  redirectTo?: string
  forbiddenPage?: RemixNode | Response
}

const DEFAULT_REDIRECT = routes.auth.login.index.href()

export function requireAdmin(options?: RequireAdminOptions): Middleware {
  let redirectTo = options?.redirectTo ?? DEFAULT_REDIRECT
  let customForbidden = options?.forbiddenPage

  return async (context, next) => {
    let auth = context.get(Auth) as AuthState<User> | undefined
    if (auth == null) {
      throw new Error('Expected auth() middleware before requireAdmin()')
    }

    if (!auth.ok) {
      let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo'))
      let location = returnTo
        ? `${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`
        : redirectTo
      let redirectHeaders = new SuperHeaders()
      redirectHeaders.location = location
      return new Response(null, {
        status: 302,
        headers: redirectHeaders,
      })
    }

    if (auth.identity.role !== 'admin') {
      if (customForbidden instanceof Response) {
        return customForbidden
      }
      if (customForbidden) {
        let render = context.get(Renderer) as (node: RemixNode, init?: ResponseInit) => Response
        return render(customForbidden, { status: 403 })
      }

      let render = context.get(Renderer) as (node: RemixNode, init?: ResponseInit) => Response
      return render(ForbiddenPage({ id: 'forbidden', props: {} } as unknown as Handle)(), { status: 403 })
    }

    return next()
  }
}
