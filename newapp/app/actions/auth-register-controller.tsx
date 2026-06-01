import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes, authRoutes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'

import { createRateLimiter } from '../utils/rate-limiter.ts'
import { users } from '../data/schema.ts'
import { hashPassword } from '../utils/password-hash.ts'
import { Layout } from '../ui/layout.tsx'
import { CsrfTokenInput } from '../ui/csrf-token-input.tsx'
import { panelCss, pageStackCss, bodyTextCss } from '../ui/page-primitives.tsx'
import { Button } from 'remix/ui/button'
import { input } from '../ui/mixins/input.ts'

// Per-email rate limiter: blocks after 5 failed registration attempts in 15 seconds.
const registerLimiter = createRateLimiter({ windowMs: 15_000, perKey: true })

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
})

export default createController<typeof authRoutes.authRegister, AppContext>(authRoutes.authRegister, {
  middleware: [],
  actions: {
    index(context) {
      return context.render(<RegisterPage />)
    },

    async action(context) {
      let formData = context.formData

      let name: string, email: string, password: string
      try {
        ({ name, email, password } = s.parse(registerSchema, formData))
      } catch {
        return context.render(<RegisterPage error="Invalid input. Name is required, email must be valid, and password must be at least 8 characters." />, { status: 400 })
      }
      let normalizedEmail = email.trim().toLowerCase()

      // Rate limit check — keyed on normalized email (case-insensitive)
      if (!registerLimiter.attempt(normalizedEmail)) {
        return context.render(
          <RegisterPage error="Too many registration attempts. Please try again later." />,
          { status: 429 },
        )
      }

      if (await context.db.findOne(users, { where: { email: normalizedEmail } })) {
        return context.render(
          <RegisterPage error="An account with this email already exists." />,
          { status: 400 },
        )
      }

      let user = await context.db.create(
        users,
        {
          name: name.trim(),
          email: normalizedEmail,
          password_hash: await hashPassword(password),
          role: 'customer',
          created_at: Date.now(),
        },
        { returnRow: true },
      )

      // Registration succeeded — reset rate limit counter for this email
      registerLimiter.reset(normalizedEmail)

      let session = context.session
      if (session == null) {
        throw new Error('Expected session() middleware before auth register')
      }
      session.regenerateId()
      session.set('auth', { userId: user.id })

      return redirect('/')
    },
  },
})

function RegisterPage(handle: Handle<{ error?: string }>) {
  return () => {
    let { error } = handle.props
    return (
    <Layout title="Register">
      <div mix={[pageStackCss, css({ maxWidth: '500px', margin: '2rem auto' })]}>
        <div mix={panelCss}>
          <h1 style={{ margin: 0, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text.primary }}>
            Register
          </h1>

          {error ? (
            <div mix={[panelCss, errorPanelCss]}>
              <p mix={bodyTextCss} style={{ color: theme.colors.action.danger.foreground, margin: 0 }}>
                {error}
              </p>
            </div>
          ) : null}

          <form method="POST" mix={formStackCss}>
            <CsrfTokenInput />
            <label mix={fieldLabelCss}>
              <span>Name</span>
              <input type="text" name="name" required autoComplete="name" mix={[input.base, input.focus]} />
            </label>

            <label mix={fieldLabelCss}>
              <span>Email</span>
              <input type="email" name="email" required autoComplete="email" mix={[input.base, input.focus]} />
            </label>

            <label mix={fieldLabelCss}>
              <span>Password</span>
              <input type="password" name="password" required autoComplete="new-password" mix={[input.base, input.focus]} />
            </label>

            <Button type="submit" tone="primary" mix={submitBtnCss}>
              Register
            </Button>
          </form>

          <p mix={bodyTextCss}>
            Already have an account? <a href={authRoutes.authLogin.index.href()} style={{ color: theme.colors.action.primary.background }}>Login here</a>
          </p>
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
