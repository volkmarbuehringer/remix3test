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
import { AuthShell, AuthForm, fieldLabelCss } from '../ui/auth-card.tsx'
import { panelCss, panelInsetCss, bodyTextCss, captionTextCss } from '../ui/page-primitives.tsx'
import { input } from '../ui/mixins/input.ts'

const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  password: f.field(s.defaulted(s.string(), '')),
})

const shortLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })
const mediumLimiter = createRateLimiter({ windowMs: 5 * 60_000, perKey: true, maxAttempts: 15 })
const longLimiter = createRateLimiter({ windowMs: 60 * 60_000, perKey: true, maxAttempts: 30 })

function checkRateLimit(email: string): { allowed: boolean; error: string; retryMs: number } | null {
  let long = longLimiter.check(email)
  if (!long.allowed) {
    return { allowed: false, error: 'Account is locked due to too many failed attempts. Please try again later.', retryMs: (long.retryAfter ?? 3600) * 1000 }
  }
  let medium = mediumLimiter.check(email)
  if (!medium.allowed) {
    return { allowed: false, error: 'Account is temporarily locked. Please try again in a few minutes.', retryMs: (medium.retryAfter ?? 300) * 1000 }
  }
  let short = shortLimiter.check(email)
  if (!short.allowed) {
    return { allowed: false, error: 'Too many attempts. Please try again later.', retryMs: (short.retryAfter ?? 15) * 1000 }
  }
  return null
}

function incrementFailedAttempts(email: string): void {
  shortLimiter.set(email)
  mediumLimiter.set(email)
  longLimiter.set(email)
}

function resetFailedAttempts(email: string): void {
  shortLimiter.reset(email)
  mediumLimiter.reset(email)
  longLimiter.reset(email)
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

      let rateLimit = checkRateLimit(parsed.email)
      if (rateLimit) {
        return context.render(<LoginPage error={rateLimit.error} returnTo={returnTo} />, { status: 429 })
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        incrementFailedAttempts(parsed.email)
        return context.render(<LoginPage error="Invalid email or password." returnTo={returnTo} />, { status: 401 })
      }

      resetFailedAttempts(parsed.email)

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

    let formAction = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'

    let footer = (
      <>
        <p mix={[bodyTextCss, css({ margin: 0 })]}>
          Don't have an account? <a href={authRoutes.authRegister.index.href()} mix={footerLinkCss}>Register here</a>
        </p>
        {process.env.NODE_ENV !== 'production' && (
          <div mix={[panelCss, panelInsetCss, demoBoxCss]}>
            <p mix={captionTextCss}><strong>Demo Accounts:</strong></p>
            <p mix={captionTextCss}>Admin: admin@newapp.com / admin123</p>
            <p mix={captionTextCss}>Customer: user@newapp.com / password123</p>
          </div>
        )}
      </>
    )

    return (
      <Layout title="Sign in">
        <AuthShell
          eyebrow="Welcome back"
          title="Sign in to newapp"
          description="Use your email and password to continue."
          header={<BrandMark />}
        >
          <AuthForm action={formAction} error={error} submitLabel="Sign in" footer={footer}>
            <label mix={fieldLabelCss}>
              <span>Email</span>
              <input type="email" name="email" required autoComplete="email" mix={[input.base, input.focus]} />
            </label>

            <label mix={fieldLabelCss}>
              <span>Password</span>
              <input type="password" name="password" required autoComplete="current-password" mix={[input.base, input.focus]} />
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

function BrandMark() {
  return () => (
    <div mix={brandMarkCss}>
      <div mix={brandDotCss} />
      <span mix={brandLabelCss}>newapp</span>
    </div>
  )
}

// ── Styles ──

const brandMarkCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.sm,
})

const brandDotCss = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: theme.colors.action.primary.background,
  flexShrink: 0,
})

const brandLabelCss = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.wide,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

const demoBoxCss = css({
  borderLeft: `3px solid ${theme.colors.action.primary.background}`,
})

const footerLinkCss = css({
  color: theme.colors.action.primary.background,
})
