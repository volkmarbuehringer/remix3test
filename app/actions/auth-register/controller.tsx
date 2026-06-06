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
import { generateToken, verificationExpires } from '../../utils/verification-token.ts'
import { sendVerificationEmail } from '../../utils/send-email.ts'
import { Layout } from '../../ui/layout.tsx'
import { AuthShell, AuthForm, fieldLabelCss, fieldErrorCss, inputWrapperCss, inputHasToggleCss, toggleButtonCss } from '../../ui/auth-card.tsx'
import type { AuthFormErrors } from '../../ui/auth-card.tsx'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { bodyTextCss } from '../../ui/page-primitives.tsx'
import { input } from '../../ui/mixins/input.ts'

const registerLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })

const REGISTER_FORM_KEYS = ['name', 'email'] as const

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(8))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(9))),
  confirmPassword: f.field(s.string().pipe(minLength(9))),
})

export default createController(routes.auth.register, {
  middleware: [],
  actions: {
    index(context) {
      return context.render(<RegisterPage />)
    },

    async action(context) {
      let formData = context.formData
      let formValues = readFormFieldValues(REGISTER_FORM_KEYS, formData)

      let parsed = s.parseSafe(registerSchema, formData)
      if (!parsed.success) {
        return context.render(<RegisterPage error="Invalid input. Name must be at least 8 characters, email must be valid, password and confirmation must be at least 9 characters." errors={issuesToFieldErrors(parsed.issues)} formValues={formValues} />, { status: 400 })
      }
      let { name, email, password } = parsed.value

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <RegisterPage error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} formValues={formValues} />,
          { status: 400 },
        )
      }

      let normalizedEmail = email.trim().toLowerCase()

      if (!registerLimiter.attempt(normalizedEmail)) {
        return context.render(
          <RegisterPage error="Too many registration attempts. Please try again later." formValues={formValues} />,
          { status: 429 },
        )
      }

      if (await context.db.findOne(users, { where: { email: normalizedEmail } })) {
        return context.render(
          <RegisterPage error="An account with this email already exists." formValues={formValues} />,
          { status: 400 },
        )
      }

      let token = generateToken()
      let expires = verificationExpires()

      let user
      try {
        user = await context.db.create(
          users,
          {
            name: name.trim(),
            email: normalizedEmail,
            password_hash: await hashPassword(password),
            role: 'customer',
            email_verified: process.env.NODE_ENV === 'test' ? 1 : 0,
            verification_token: token,
            verification_expires: expires,
            created_at: Date.now(),
          },
          { returnRow: true },
        )
      } catch (err) {
        let code = (err as { code?: string }).code
        if (code === '23505') {
          return context.render(
            <RegisterPage error="An account with this email already exists." formValues={formValues} />,
            { status: 400 },
          )
        }
        throw err
      }

      registerLimiter.reset(normalizedEmail)

      if (process.env.NODE_ENV !== 'test') {
        let serverUrl = process.env.SERVER_URL || context.url.origin
        let verificationUrl = `${serverUrl}${routes.auth.verify.href({ token })}`
        try {
          await sendVerificationEmail(
            context.mailer,
            { name: user.name, email: user.email },
            verificationUrl,
          )
        } catch (err) {
          console.error('Failed to send verification email:', err)
          return context.render(
            <RegisterPage error="Unable to send verification email. Please try again later." formValues={formValues} />,
            { status: 500 },
          )
        }
      }

      return redirect(routes.auth.registerSent.href())
    },
  },
})

export async function registerSent(context: AppContext) {
  return context.render(<RegisterSentPage />)
}

function RegisterPage(handle: Handle<{ error?: string; errors?: AuthFormErrors; formValues?: Record<string, string> }>) {
  return () => {
    let { error, errors, formValues } = handle.props

    let footer = (
      <p mix={[bodyTextCss, css({ margin: 0 })]}>
        Already have an account? <a href={routes.auth.login.index.href()} mix={footerLinkCss}>Login here</a>
      </p>
    )

    return (
      <Layout title="Create account">
        <AuthShell
          eyebrow="Get started"
          title="Create your account"
          description="Fill in your details to create a new account."
        >
          <AuthForm action={routes.auth.register.action.href()} error={error} submitLabel="Create account" footer={footer}>
            <label mix={fieldLabelCss}>
              <span>Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  minLength={8}
                  defaultValue={formValues?.name ?? ''}
                aria-invalid={errors?.name ? true : undefined}
                aria-describedby={errors?.name ? 'name-error' : undefined}
                mix={[input.base, input.focus, errors?.name ? input.error : undefined]}
              />
              {errors?.name ? <span id="name-error" role="alert" mix={fieldErrorCss}>{errors.name}</span> : null}
            </label>

            <label mix={fieldLabelCss}>
              <span>Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                defaultValue={formValues?.email ?? ''}
                aria-invalid={errors?.email ? true : undefined}
                aria-describedby={errors?.email ? 'email-error' : undefined}
                mix={[input.base, input.focus, errors?.email ? input.error : undefined]}
              />
              {errors?.email ? <span id="email-error" role="alert" mix={fieldErrorCss}>{errors.email}</span> : null}
            </label>

            <label mix={fieldLabelCss}>
              <span>Password</span>
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

function RegisterSentPage(handle: Handle<{}>) {
  return () => (
    <Layout title="Check your email">
      <AuthShell
        eyebrow="Almost there"
        title="Check your email"
        description="We've sent a verification link to your email address. Please check your inbox and click the link to complete your registration."
      >
        <p mix={bodyTextCss}>The verification link will expire in 24 hours.</p>
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()} mix={footerLinkCss}>Back to login</a>
        </p>
      </AuthShell>
    </Layout>
  )
}

const footerLinkCss = css({
  color: theme.colors.action.primary.background,
})
