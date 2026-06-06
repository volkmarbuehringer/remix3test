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
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'

const registerLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })

const REGISTER_FORM_KEYS = ['name', 'email'] as const

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(8))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
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
        return context.render(<RegisterPage error={`Ungültige Eingabe. Der Name muss mindestens 8 Zeichen lang sein, die E-Mail-Adresse muss gültig sein und das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`} errors={issuesToFieldErrors(parsed.issues)} formValues={formValues} />, { status: 400 })
      }
      let { name, email, password } = parsed.value

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <RegisterPage error="Die Passwörter stimmen nicht überein." errors={{ confirmPassword: 'Die Passwörter stimmen nicht überein.' }} formValues={formValues} />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(password)
      if (complexityError) {
        return context.render(
          <RegisterPage error={complexityError} errors={{ password: complexityError }} formValues={formValues} />,
          { status: 400 },
        )
      }

      let normalizedEmail = email.trim().toLowerCase()

      if (!registerLimiter.attempt(normalizedEmail)) {
        return context.render(
          <RegisterPage error="Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut." formValues={formValues} />,
          { status: 429 },
        )
      }

      if (await context.db.findOne(users, { where: { email: normalizedEmail } })) {
        return context.render(
          <RegisterPage error="Ein Konto mit dieser E-Mail-Adresse existiert bereits." formValues={formValues} />,
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
            <RegisterPage error="Ein Konto mit dieser E-Mail-Adresse existiert bereits." formValues={formValues} />,
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
            <RegisterPage error="Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut." formValues={formValues} />,
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
        Bereits ein Konto? <a href={routes.auth.login.index.href()} mix={footerLinkCss}>Hier anmelden</a>
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
              <span>Passwort</span>
              <p id="password-hint" mix={hintCss}>Das Passwort muss mindestens 10 Zeichen lang sein sowie mindestens eine Zahl und ein Sonderzeichen enthalten.</p>
              <div mix={inputWrapperCss}>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={errors?.password ? true : undefined}
                  aria-describedby={`password-hint${errors?.password ? ' password-error' : ''}`}
                  mix={[input.base, input.focus, errors?.password ? input.error : undefined, inputHasToggleCss]}
                />
                <button type="button" data-toggle-pw="password" aria-label="Passwort anzeigen" mix={toggleButtonCss}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              {errors?.password ? <span id="password-error" role="alert" mix={fieldErrorCss}>{errors.password}</span> : null}
              <div data-pw-complexity mix={complexityFeedbackCss}></div>
              <script>{`document.addEventListener('input',e=>{let i=e.target;if(i.name!=='password')return;let f=i.closest('form');if(!f)return;let g=f.querySelector('[data-pw-complexity]');if(!g)return;let v=i.value;g.innerHTML=[['Mindestens 10 Zeichen',v.length>=10],['Mindestens eine Zahl (0-9)',/[0-9]/.test(v)],['Mindestens ein Sonderzeichen',/[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?\`~]/.test(v)]].map(r=>'<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:'+(r[1]?'#16a34a':'#6b7280')+'">'+(r[1]?'\\u2713':'\\u25CB')+' '+r[0]+'</span>').join('')})`}</script>
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
