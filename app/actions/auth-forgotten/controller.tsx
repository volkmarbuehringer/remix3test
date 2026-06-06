import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'

import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { users } from '../../data/schema.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { generateToken, resetExpires } from '../../utils/verification-token.ts'
import { sendPasswordResetEmail } from '../../utils/send-email.ts'
import { pool } from '../../data/setup.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { Layout } from '../../ui/layout.tsx'
import { AuthShell, AuthForm, fieldLabelCss, fieldErrorCss, inputWrapperCss, inputHasToggleCss, toggleButtonCss } from '../../ui/auth-card.tsx'
import type { AuthFormErrors } from '../../ui/auth-card.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { bodyTextCss } from '../../ui/page-primitives.tsx'
import { input } from '../../ui/mixins/input.ts'

const forgotLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })
const resetLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })

const emailSchema = f.object({
  email: f.field(s.string().pipe(email())),
})

const passwordSchema = f.object({
  password: f.field(s.string().pipe(minLength(9))),
  confirmPassword: f.field(s.string().pipe(minLength(9))),
})

export default createController(routes.auth.forgotten, {
  middleware: [],
  actions: {
    index(context) {
      return context.render(<ForgotPage />)
    },

    async action(context) {
      let parsed = s.parseSafe(emailSchema, context.formData)
      if (!parsed.success) {
        return context.render(<ForgotPage error="Please enter a valid email address." errors={issuesToFieldErrors(parsed.issues)} />, { status: 400 })
      }

      let normalizedEmail = parsed.value.email.trim().toLowerCase()

      if (!forgotLimiter.attempt(normalizedEmail)) {
        return context.render(
          <ForgotPage error="Too many attempts. Please try again later." />,
          { status: 429 },
        )
      }

      let user = await context.db.findOne(users, { where: { email: normalizedEmail } })
      if (user) {
        let token = generateToken()
        let expires = resetExpires()

        await context.db.update(users, user.id, {
          password_reset_token: token,
          password_reset_expires: expires,
        })

        let serverUrl = process.env.SERVER_URL || context.url.origin
        let resetUrl = `${serverUrl}${routes.auth.forgottenReset.index.href({ token })}`
        try {
          await sendPasswordResetEmail(
            context.mailer,
            { name: user.name, email: user.email },
            resetUrl,
          )
        } catch (err) {
          console.error('Failed to send password reset email:', err)
        }
      }

      return context.render(<ForgotSentPage />)
    },
  },
})

export const forgottenReset = createController(routes.auth.forgottenReset, {
  middleware: [],
  actions: {
    async index(context) {
      let token = (context.params as Record<string, string>).token
      let result = await validateResetToken(context.db, token)
      if (result.error) {
        return context.render(<ResetErrorPage title={result.error.title} message={result.error.message} />, { status: 400 })
      }
      return context.render(<ResetFormPage token={token} />)
    },

    async action(context) {
      let token = (context.params as Record<string, string>).token

      if (!resetLimiter.attempt(token)) {
        // Invalidate the token so it can't be retried after rate limit resets
        try {
          let userByToken = await context.db.findOne(users, { where: { password_reset_token: token } })
          if (userByToken) {
            await context.db.update(users, (userByToken as { id: number }).id, {
              password_reset_token: null as unknown as string,
              password_reset_expires: null as unknown as number,
            })
          }
        } catch {
          // Token invalidation is best-effort; rate limit error takes priority
        }
        return context.render(
          <ResetErrorPage title="Too many attempts" message="Too many reset attempts. Please request a new reset link." />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(passwordSchema, context.formData)
      if (!parsed.success) {
        return context.render(<ResetFormPage token={token} error="Password and confirmation must be at least 9 characters." errors={issuesToFieldErrors(parsed.issues)} />, { status: 400 })
      }

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <ResetFormPage token={token} error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} />,
          { status: 400 },
        )
      }

      let result = await validateResetToken(context.db, token)
      if (result.error) {
        return context.render(<ResetErrorPage title={result.error.title} message={result.error.message} />, { status: 400 })
      }

      await context.db.update(users, result.user.id, {
        password_hash: await hashPassword(parsed.value.password),
        password_reset_token: null as unknown as string,
        password_reset_expires: null as unknown as number,
      })

      try {
        await logAdminAction(pool, {
          admin_user_id: result.user.id,
          admin_email: result.user.email,
          action_type: 'password_reset_self',
          target_type: 'user',
          target_id: result.user.id,
        })
      } catch {
        // audit log failure should not block the reset
      }

      let session = context.session
      if (session) {
        session.unset('auth')
        session.flash('reset', 'Password reset successfully! Please log in.')
      }

      return redirect(routes.auth.login.index.href())
    },
  },
})

async function validateResetToken(
  db: AppContext['db'],
  token?: string,
): Promise<{ error: { title: string; message: string } } | { error: null; user: { id: number; email: string } }> {
  if (!token) {
    return { error: { title: 'Invalid reset link', message: 'This reset link is invalid.' } }
  }

  let user = await db.findOne(users, { where: { password_reset_token: token } })
  if (!user) {
    return { error: { title: 'Invalid reset link', message: 'This reset link is invalid or has already been used.' } }
  }

  if (user.password_reset_expires != null && user.password_reset_expires < Date.now()) {
    return { error: { title: 'Link expired', message: 'This reset link has expired. Please request a new one.' } }
  }

  return { error: null, user: { id: user.id, email: user.email } }
}

function ForgotPage(handle: Handle<{ error?: string; errors?: AuthFormErrors }>) {
  return () => {
    let { error, errors } = handle.props

    let footer = (
      <p mix={[bodyTextCss, css({ margin: 0 })]}>
        <a href={routes.auth.login.index.href()} mix={footerLinkCss}>Back to login</a>
      </p>
    )

    return (
      <Layout title="Forgot password">
        <AuthShell
          eyebrow="Password reset"
          title="Forgot your password?"
          description="Enter your email address and we'll send you a link to reset your password."
        >
          <AuthForm action={routes.auth.forgotten.action.href()} error={error} submitLabel="Send reset link" footer={footer}>
            <label mix={fieldLabelCss}>
              <span>Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                aria-invalid={errors?.email ? true : undefined}
                aria-describedby={errors?.email ? 'email-error' : undefined}
                mix={[input.base, input.focus, errors?.email ? input.error : undefined]}
              />
              {errors?.email ? <span id="email-error" role="alert" mix={fieldErrorCss}>{errors.email}</span> : null}
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

function ForgotSentPage(handle: Handle<{}>) {
  return () => (
    <Layout title="Check your email">
      <AuthShell
        eyebrow="Email sent"
        title="Check your email"
        description="If an account with that email exists, we've sent a password reset link."
      >
        <p mix={bodyTextCss}>The link will expire in 1 hour.</p>
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()} mix={footerLinkCss}>Back to login</a>
        </p>
      </AuthShell>
    </Layout>
  )
}

function ResetFormPage(handle: Handle<{ token: string; error?: string; errors?: AuthFormErrors }>) {
  return () => {
    let { token, error, errors } = handle.props

    return (
      <Layout title="Reset password">
        <AuthShell
          eyebrow="Password reset"
          title="Set a new password"
          description="Enter your new password below."
        >
          <AuthForm action={routes.auth.forgottenReset.action.href({ token })} error={error} submitLabel="Reset password">
            <label mix={fieldLabelCss}>
              <span>New password</span>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  minLength={9}
                  aria-invalid={errors?.password ? true : undefined}
                  aria-describedby={errors?.password ? 'password-error' : undefined}
                  mix={[input.base, input.focus, errors?.password ? input.error : undefined, inputHasToggleCss]}
                />
                <button type="button" data-toggle-pw="password" aria-label="Show password" mix={toggleButtonCss}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              {errors?.password ? <span id="password-error" role="alert" mix={fieldErrorCss}>{errors.password}</span> : null}
            </label>

            <label mix={fieldLabelCss}>
              <span>Confirm password</span>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  minLength={9}
                  aria-invalid={errors?.confirmPassword ? true : undefined}
                  aria-describedby={errors?.confirmPassword ? 'confirm-password-error' : undefined}
                  mix={[input.base, input.focus, errors?.confirmPassword ? input.error : undefined, inputHasToggleCss]}
                />
                <button type="button" data-toggle-pw="confirmPassword" aria-label="Show password" mix={toggleButtonCss}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              {errors?.confirmPassword ? <span id="confirm-password-error" role="alert" mix={fieldErrorCss}>{errors.confirmPassword}</span> : null}
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

function ResetErrorPage(handle: Handle<{ title: string; message: string }>) {
  return () => (
    <Layout title="Password reset">
      <AuthShell
        eyebrow="Password reset"
        title={handle.props.title}
        description={handle.props.message}
      >
        <p mix={bodyTextCss}>
          <a href={routes.auth.forgotten.index.href()} mix={footerLinkCss}>Request a new reset link</a>
        </p>
      </AuthShell>
    </Layout>
  )
}

const footerLinkCss = css({
  color: theme.colors.action.primary.background,
})
