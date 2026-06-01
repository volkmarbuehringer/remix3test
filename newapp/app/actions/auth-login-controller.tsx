import { verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import { email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { authRoutes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

import { createRateLimiter } from '../utils/rate-limiter.ts'
import { passwordProvider } from '../middleware/auth.ts'
import { getSafeReturnTo } from '../utils/redirect.ts'
import { Layout } from '../ui/layout.tsx'
import { CsrfTokenInput } from '../ui/csrf-token-input.tsx'
import { panelCss, panelInsetCss, pageStackCss, bodyTextCss, captionTextCss } from '../ui/page-primitives.tsx'
import { Button } from 'remix/ui/button'
import { input } from '../ui/mixins/input.ts'
import { brand } from '../theme.tsx'

const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  password: f.field(s.defaulted(s.string(), '')),
})

// Per-email rate limiter: blocks after 5 failed attempts in 15 seconds
const loginLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })

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

      if (!loginLimiter.attempt(parsed.email)) {
        return context.render(<LoginPage error="Too many attempts. Please try again later." returnTo={returnTo} />, { status: 429 })
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        return context.render(<LoginPage error="Invalid email or password." returnTo={returnTo} />, { status: 401 })
      }

      loginLimiter.reset(parsed.email)

      let session = completeAuth(context)
      session.regenerateId()
      session.set('auth', { userId: user.id })

      returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? '/'
      return redirect(returnTo)
    },
  },
})

// ── Page component ──

type LoginPageProps = {
  error?: string
  returnTo?: string
}

function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { error, returnTo } = handle.props
    return (
    <Layout title="Login">
      <div mix={[pageStackCss, css({ maxWidth: '480px', margin: '4rem auto' })]}>
        <div mix={panelCss}>
          <div mix={brandMarkCss}>
            <div mix={brandDotCss} />
            <span mix={brandLabelCss}>newapp</span>
          </div>

          <h1 mix={headingCss}>
            Login
          </h1>

          {error ? (
            <div mix={errorBannerCss}>
              <p mix={[bodyTextCss, css({ margin: 0 })]}>
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
            Don't have an account? <a href={authRoutes.authRegister.index.href()} style={{ color: brand.light.accent }}>Register here</a>
          </p>

          <div mix={[panelCss, panelInsetCss, demoBoxCss]}>
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

// ── Styles ──

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

const brandMarkCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const brandDotCss = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: brand.light.accent,
  flexShrink: 0,
  '[data-theme="dark"] &': {
    backgroundColor: brand.dark.accent,
  },
})

const brandLabelCss = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.wide,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const headingCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  marginBottom: theme.space.lg,
})

const errorBannerCss = css({
  borderLeft: `3px solid ${theme.colors.action.danger.background}`,
  backgroundColor: theme.surface.lvl2,
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderRadius: theme.radius.sm,
  marginBottom: theme.space.md,
})

const demoBoxCss = css({
  borderLeft: `3px solid ${brand.light.accent}`,
  '[data-theme="dark"] &': {
    borderLeftColor: brand.dark.accent,
  },
})
