import { verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { getContext } from 'remix/middleware/async-context'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes, authRoutes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

import { passwordProvider } from '../middleware/auth.ts'
import { getSafeReturnTo } from '../utils/redirect.ts'
import { Layout } from '../ui/layout.tsx'
import { CsrfTokenInput } from '../ui/csrf-token-input.tsx'
import { panelCss, panelInsetCss, pageStackCss, bodyTextCss, captionTextCss } from '../ui/page-primitives.tsx'
import { Button } from 'remix/ui/button'
import { input } from '../ui/mixins/input.ts'

const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  password: f.field(s.defaulted(s.string(), '')),
})

// Per-email rate limiter: blocks after 5 failed attempts in 15 seconds
const loginFailures = new Map<string, { count: number; firstAt: number }>()
const LOGIN_WINDOW_MS = 15_000
const LOGIN_MAX_ATTEMPTS = 5

function isLoginRateLimited(email: string): boolean {
  let entry = loginFailures.get(email)
  if (!entry) return false
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(email)
    return false
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS
}

function recordLoginFailure(email: string): void {
  let now = Date.now()
  let entry = loginFailures.get(email)
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.set(email, { count: 1, firstAt: now })
  } else {
    entry.count++
  }
}

function clearLoginRateLimit(email: string): void {
  loginFailures.delete(email)
}

export default createController<typeof authRoutes.authLogin, AppContext>(authRoutes.authLogin, {
  middleware: [],
  actions: {
    index(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      return context.render(<LoginPage returnTo={returnTo} />)
    },

    async action(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined

      let parsed: { email: string }
      try {
        parsed = s.parse(loginSchema, context.formData) as { email: string }
      } catch {
        return context.render(<LoginPage error="Invalid email or password format." returnTo={returnTo} />, { status: 400 })
      }

      if (isLoginRateLimited(parsed.email)) {
        return context.render(<LoginPage error="Too many attempts. Please try again later." returnTo={returnTo} />, { status: 429 })
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        recordLoginFailure(parsed.email)
        return context.render(<LoginPage error="Invalid email or password." returnTo={returnTo} />, { status: 401 })
      }

      clearLoginRateLimit(parsed.email)

      let session = completeAuth(context)
      session.regenerateId()
      session.set('auth', { userId: user.id })

      returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? '/'
      return redirect(returnTo)
    },
  },
})

type LoginPageProps = {
  error?: string
  returnTo?: string
}

function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { error, returnTo } = handle.props
    return (
    <Layout title="Login">
      <div mix={pageStackCss} style={{ maxWidth: '500px', margin: '2rem auto' }}>
        <div mix={panelCss}>
          <h1 style={{ margin: 0, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text.primary }}>
            Login
          </h1>

          {error ? (
            <div mix={[panelCss, errorPanelCss]}>
              <p mix={bodyTextCss} style={{ color: theme.colors.action.danger.background, margin: 0 }}>
                {error}
              </p>
            </div>
          ) : null}

          <form method="POST" action={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} mix={formStackCss}>
            <CsrfTokenInput />
            <label mix={fieldLabelCss}>
              <span>Email</span>
              <input type="email" name="email" required autoComplete="email" mix={[input.base, input.focus]} />
            </label>

            <label mix={fieldLabelCss}>
              <span>Password</span>
              <input type="password" name="password" required autoComplete="current-password" mix={[input.base, input.focus]} />
            </label>

            <Button type="submit" tone="primary" mix={submitBtnCss}>
              Login
            </Button>
          </form>

          <p mix={bodyTextCss}>
            Don't have an account? <a href={authRoutes.authRegister.index.href()} style={{ color: theme.colors.action.primary.background }}>Register here</a>
          </p>

          <div mix={[panelCss, panelInsetCss]}>
            <p mix={captionTextCss}><strong>Demo Accounts:</strong></p>
            <p mix={captionTextCss}>Admin: admin@newapp.com / admin123</p>
            <p mix={captionTextCss}>Customer: user@newapp.com / password123</p>
          </div>
        </div>
      </div>
    </Layout>
  )
  }
}

const errorPanelCss = css({
  borderColor: theme.colors.action.danger.background,
  backgroundColor: theme.surface.lvl2,
})

const formStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

const fieldLabelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  color: theme.colors.text.secondary,
  fontWeight: theme.fontWeight.medium,
  fontSize: theme.fontSize.sm,
})

const submitBtnCss = css({
  width: '100%',
  fontSize: theme.fontSize.lg,
  minHeight: theme.control.height.lg,
  marginTop: theme.space.sm,
})
