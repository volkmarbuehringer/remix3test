import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import { Glyph } from '../../ui/theme/glyph/glyph.tsx'

import { routes } from '../../routes.ts'

import { Layout } from '../../ui/layout.tsx'
import {
  AuthShell,
  AuthForm,
  fieldLabelCss,
  fieldErrorCss,
  inputWrapperCss,
  inputHasToggleCss,
  toggleButtonCss,
} from '../../ui/auth-card.tsx'
import type { AuthFormErrors } from '../../ui/auth-card.tsx'
import { bodyTextCss } from '../../ui/page-primitives.tsx'
import { input } from '../../ui/mixins/input.ts'
import { PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { passwordComplexityScript } from '../../assets/password-complexity-script.tsx'

// ── Login ──

type LoginPageProps = {
  error?: string
  errors?: AuthFormErrors
  returnTo?: string
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { error, errors, returnTo } = handle.props

    let formAction = routes.auth.login.action.href()
    if (returnTo) formAction += `?returnTo=${encodeURIComponent(returnTo)}`

    let footer = (
      <>
        <p mix={[bodyTextCss, css({ margin: 0 })]}>
          <a href={routes.auth.forgotten.index.href()} mix={footerLinkCss}>
            Forgot password?
          </a>
        </p>
        <p mix={[bodyTextCss, css({ margin: 0 })]}>
          Don't have an account?{' '}
          <a href={routes.auth.register.index.href()} mix={footerLinkCss}>
            Register here
          </a>
        </p>
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
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                aria-invalid={errors?.email ? true : undefined}
                aria-describedby={errors?.email ? 'email-error' : undefined}
                mix={[input.base, input.focus, errors?.email ? input.error : undefined]}
              />
              {errors?.email ? (
                <span id="email-error" role="alert" mix={fieldErrorCss}>
                  {errors.email}
                </span>
              ) : null}
            </label>

            <label mix={fieldLabelCss}>
              <span>Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                aria-invalid={errors?.password ? true : undefined}
                aria-describedby={errors?.password ? 'password-error' : undefined}
                mix={[input.base, input.focus, errors?.password ? input.error : undefined]}
              />
              {errors?.password ? (
                <span id="password-error" role="alert" mix={fieldErrorCss}>
                  {errors.password}
                </span>
              ) : null}
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

// ── Register ──

type RegisterPageProps = {
  error?: string
  errors?: AuthFormErrors
  formValues?: Record<string, string>
}

export function RegisterPage(handle: Handle<RegisterPageProps>) {
  return () => {
    let { error, errors, formValues } = handle.props

    let footer = (
      <p mix={[bodyTextCss, css({ margin: 0 })]}>
        Bereits ein Konto?{' '}
        <a href={routes.auth.login.index.href()} mix={footerLinkCss}>
          Hier anmelden
        </a>
      </p>
    )

    return (
      <Layout title="Create account">
        <AuthShell
          eyebrow="Get started"
          title="Create your account"
          description="Fill in your details to create a new account."
        >
          <AuthForm
            action={routes.auth.register.action.href()}
            error={error}
            submitLabel="Create account"
            footer={footer}
          >
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
              {errors?.name ? (
                <span id="name-error" role="alert" mix={fieldErrorCss}>
                  {errors.name}
                </span>
              ) : null}
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
              {errors?.email ? (
                <span id="email-error" role="alert" mix={fieldErrorCss}>
                  {errors.email}
                </span>
              ) : null}
            </label>

            <label mix={fieldLabelCss}>
              <span>Passwort</span>
              <p id="password-hint" mix={hintCss}>
                Das Passwort muss mindestens 10 Zeichen lang sein sowie mindestens eine Zahl und ein
                Sonderzeichen enthalten.
              </p>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={errors?.password ? true : undefined}
                  aria-describedby={`password-hint${errors?.password ? ' password-error' : ''}`}
                  mix={[
                    input.base,
                    input.focus,
                    errors?.password ? input.error : undefined,
                    inputHasToggleCss,
                  ]}
                />
                <button
                  type="button"
                  data-toggle-pw="password"
                  aria-label="Passwort anzeigen"
                  mix={toggleButtonCss}
                >
                  <Glyph name="eye" width={18} height={18} />
                </button>
              </div>
              {errors?.password ? (
                <span id="password-error" role="alert" mix={fieldErrorCss}>
                  {errors.password}
                </span>
              ) : null}
              <div data-pw-complexity mix={complexityFeedbackCss}></div>
              <script>{passwordComplexityScript('password')}</script>
            </label>

            <label mix={fieldLabelCss}>
              <span>Passwort bestätigen</span>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={errors?.confirmPassword ? true : undefined}
                  aria-describedby={errors?.confirmPassword ? 'confirm-password-error' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    errors?.confirmPassword ? input.error : undefined,
                    inputHasToggleCss,
                  ]}
                />
                <button
                  type="button"
                  data-toggle-pw="confirmPassword"
                  aria-label="Show password"
                  mix={toggleButtonCss}
                >
                  <Glyph name="eye" width={18} height={18} />
                </button>
              </div>
              {errors?.confirmPassword ? (
                <span id="confirm-password-error" role="alert" mix={fieldErrorCss}>
                  {errors.confirmPassword}
                </span>
              ) : null}
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

export function RegisterSentPage(handle: Handle<{}>) {
  return () => (
    <Layout title="Check your email">
      <AuthShell
        eyebrow="Almost there"
        title="Check your email"
        description="We've sent a verification link to your email address. Please check your inbox and click the link to complete your registration."
      >
        <p mix={bodyTextCss}>The verification link will expire in 24 hours.</p>
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()} mix={footerLinkCss}>
            Back to login
          </a>
        </p>
      </AuthShell>
    </Layout>
  )
}

// ── Forgot / Reset ──

type ForgotPageProps = {
  error?: string
  errors?: AuthFormErrors
}

export function ForgotPage(handle: Handle<ForgotPageProps>) {
  return () => {
    let { error, errors } = handle.props

    let footer = (
      <p mix={[bodyTextCss, css({ margin: 0 })]}>
        <a href={routes.auth.login.index.href()} mix={footerLinkCss}>
          Back to login
        </a>
      </p>
    )

    return (
      <Layout title="Forgot password">
        <AuthShell
          eyebrow="Password reset"
          title="Forgot your password?"
          description="Enter your email address and we'll send you a link to reset your password."
        >
          <AuthForm
            action={routes.auth.forgotten.action.href()}
            error={error}
            submitLabel="Send reset link"
            footer={footer}
          >
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
              {errors?.email ? (
                <span id="email-error" role="alert" mix={fieldErrorCss}>
                  {errors.email}
                </span>
              ) : null}
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

export function ForgotSentPage(handle: Handle<{}>) {
  return () => (
    <Layout title="Check your email">
      <AuthShell
        eyebrow="Email sent"
        title="Check your email"
        description="If an account with that email exists, we've sent a password reset link."
      >
        <p mix={bodyTextCss}>The link will expire in 1 hour.</p>
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()} mix={footerLinkCss}>
            Zurück zum Login
          </a>
        </p>
      </AuthShell>
    </Layout>
  )
}

type ResetFormPageProps = {
  token: string
  error?: string
  errors?: AuthFormErrors
}

export function ResetFormPage(handle: Handle<ResetFormPageProps>) {
  return () => {
    let { token, error, errors } = handle.props

    return (
      <Layout title="Reset password">
        <AuthShell
          eyebrow="Password reset"
          title="Set a new password"
          description="Enter your new password below."
        >
          <AuthForm
            action={routes.auth.forgottenReset.action.href({ token })}
            error={error}
            submitLabel="Reset password"
          >
            <label mix={fieldLabelCss}>
              <span>Neues Passwort</span>
              <p id="password-hint" mix={hintCss}>
                Das Passwort muss mindestens 10 Zeichen lang sein sowie mindestens eine Zahl und ein
                Sonderzeichen enthalten.
              </p>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={errors?.password ? true : undefined}
                  aria-describedby={`password-hint${errors?.password ? ' password-error' : ''}`}
                  mix={[
                    input.base,
                    input.focus,
                    errors?.password ? input.error : undefined,
                    inputHasToggleCss,
                  ]}
                />
                <button
                  type="button"
                  data-toggle-pw="password"
                  aria-label="Passwort anzeigen"
                  mix={toggleButtonCss}
                >
                  <Glyph name="eye" width={18} height={18} />
                </button>
              </div>
              {errors?.password ? (
                <span id="password-error" role="alert" mix={fieldErrorCss}>
                  {errors.password}
                </span>
              ) : null}
              <div data-pw-complexity mix={complexityFeedbackCss}></div>
              <script>{passwordComplexityScript('password')}</script>
            </label>

            <label mix={fieldLabelCss}>
              <span>Passwort bestätigen</span>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={errors?.confirmPassword ? true : undefined}
                  aria-describedby={errors?.confirmPassword ? 'confirm-password-error' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    errors?.confirmPassword ? input.error : undefined,
                    inputHasToggleCss,
                  ]}
                />
                <button
                  type="button"
                  data-toggle-pw="confirmPassword"
                  aria-label="Show password"
                  mix={toggleButtonCss}
                >
                  <Glyph name="eye" width={18} height={18} />
                </button>
              </div>
              {errors?.confirmPassword ? (
                <span id="confirm-password-error" role="alert" mix={fieldErrorCss}>
                  {errors.confirmPassword}
                </span>
              ) : null}
            </label>
          </AuthForm>
        </AuthShell>
      </Layout>
    )
  }
}

export function ResetErrorPage(handle: Handle<{ title: string; message: string }>) {
  return () => (
    <Layout title="Password reset">
      <AuthShell
        eyebrow="Password reset"
        title={handle.props.title}
        description={handle.props.message}
      >
        <p mix={bodyTextCss}>
          <a href={routes.auth.forgotten.index.href()} mix={footerLinkCss}>
            Neuen Link anfordern
          </a>
        </p>
      </AuthShell>
    </Layout>
  )
}

// ── Verify ──

export function VerifyErrorPage(handle: Handle<{ title: string; message: string }>) {
  return () => (
    <Layout title="Verification">
      <AuthShell
        eyebrow="Verification"
        title={handle.props.title}
        description={handle.props.message}
      >
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()}>Back to login</a>
        </p>
      </AuthShell>
    </Layout>
  )
}

// ── Shared styles ──

const hintCss = css({
  margin: '0 0 0.25rem',
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

const complexityFeedbackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginTop: theme.space.xs,
})

const footerLinkCss = css({
  color: theme.colors.action.primary.background,
})
