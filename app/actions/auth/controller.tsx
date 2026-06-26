import { verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import { email, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { getContext } from 'remix/middleware/async-context'
import { Logger } from 'remix/middleware/logger'
import { createAction, createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../data/audit-log.ts'
import { pool } from '../../data/setup.ts'
import { users } from '../../data/schema.ts'
import { passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { getSafeReturnTo } from '../../utils/redirect.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/send-email.ts'
import { generateToken, resetExpires, verificationExpires } from '../../utils/verification-token.ts'
import { sourceIp } from '../../lib/request-ip.ts'

import { LoginPage, RegisterPage, RegisterSentPage, ForgotPage, ForgotSentPage, ResetFormPage, ResetErrorPage, VerifyErrorPage } from './pages.tsx'

// ── Login ──

const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  password: f.field(s.defaulted(s.string(), '')),
})

const shortLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })
const mediumLimiter = createRateLimiter({ windowMs: 5 * 60_000, perKey: true, maxAttempts: 15 })
const longLimiter = createRateLimiter({ windowMs: 60 * 60_000, perKey: true, maxAttempts: 30 })
const ipLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 20 })

function checkRateLimit(email: string, ip: string): { allowed: boolean; error: string; retryMs: number } | null {
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
  let ipCheck = ipLimiter.check(ip)
  if (!ipCheck.allowed) {
    return { allowed: false, error: 'Too many attempts from this IP. Please try again later.', retryMs: (ipCheck.retryAfter ?? 60) * 1000 }
  }
  return null
}

function incrementFailedAttempts(email: string, ip: string): void {
  shortLimiter.set(email)
  mediumLimiter.set(email)
  longLimiter.set(email)
  ipLimiter.set(ip)
}

function resetFailedAttempts(email: string): void {
  shortLimiter.reset(email)
  mediumLimiter.reset(email)
  longLimiter.reset(email)
}

export const authLogin = createController<typeof routes.auth.login, AppContext>(routes.auth.login, {
  middleware: [],
  actions: {
    index(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      return context.render(<LoginPage returnTo={returnTo} />)
    },

    async action(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined

      let parsed = s.parseSafe(loginSchema, context.formData)
      if (!parsed.success) {
        return context.render(<LoginPage error="Invalid email or password format." errors={issuesToFieldErrors(parsed.issues)} returnTo={returnTo} />, { status: 400 })
      }

      let rateLimit = checkRateLimit(parsed.value.email, sourceIp(context.request))
      if (rateLimit) {
        return context.render(<LoginPage error={rateLimit.error} returnTo={returnTo} />, { status: 429 })
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        incrementFailedAttempts(parsed.value.email, sourceIp(context.request))
        return context.render(<LoginPage error="Invalid email or password." returnTo={returnTo} />, { status: 401 })
      }

      resetFailedAttempts(parsed.value.email)

      let session = completeAuth(context)
      session.set('auth', { userId: user.id, tv: user.token_version })

      returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? '/'
      return redirect(returnTo)
    },
  },
})

// ── Register ──

const registerLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })

const REGISTER_FORM_KEYS = ['name', 'email'] as const

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(8))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
})

export const authRegister = createController<typeof routes.auth.register, AppContext>(routes.auth.register, {
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
        let verificationUrl = `${context.url.origin}${routes.auth.verify.href({ token })}`
        try {
          await sendVerificationEmail(
            context.mailer,
            { name: user.name, email: user.email },
            verificationUrl,
          )
        } catch (err) {
          context.get(Logger)?.('Failed to send verification email: ' + String(err))
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

// ── Forgot / Reset ──

const forgotLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })
const resetLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })

const emailSchema = f.object({
  email: f.field(s.string().pipe(email())),
})

const passwordSchema = f.object({
  password: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
})

export const authForgotten = createController<typeof routes.auth.forgotten, AppContext>(routes.auth.forgotten, {
  middleware: [],
  actions: {
    index(context) {
      return context.render(<ForgotPage />)
    },

    async action(context) {
      let parsed = s.parseSafe(emailSchema, context.formData)
      if (!parsed.success) {
        return context.render(<ForgotPage error="Bitte geben Sie eine gültige E-Mail-Adresse ein." errors={issuesToFieldErrors(parsed.issues)} />, { status: 400 })
      }

      let normalizedEmail = parsed.value.email.trim().toLowerCase()

      if (!forgotLimiter.attempt(normalizedEmail)) {
        return context.render(
          <ForgotPage error="Zu viele Versuche. Bitte versuchen Sie es später erneut." />,
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

        let resetUrl = `${context.url.origin}${routes.auth.forgottenReset.index.href({ token })}`
        try {
          await sendPasswordResetEmail(
            context.mailer,
            { name: user.name, email: user.email },
            resetUrl,
          )
        } catch (err) {
          context.get(Logger)?.('Failed to send password reset email: ' + String(err))
        }
      }

      return context.render(<ForgotSentPage />)
    },
  },
})

export const authForgottenReset = createController<typeof routes.auth.forgottenReset, AppContext>(routes.auth.forgottenReset, {
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
          <ResetErrorPage title="Zu viele Versuche" message="Zu viele Versuche. Bitte fordern Sie einen neuen Link an." />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(passwordSchema, context.formData)
      if (!parsed.success) {
        return context.render(<ResetFormPage token={token} error={`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`} errors={issuesToFieldErrors(parsed.issues)} />, { status: 400 })
      }

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <ResetFormPage token={token} error="Die Passwörter stimmen nicht überein." errors={{ confirmPassword: 'Die Passwörter stimmen nicht überein.' }} />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(parsed.value.password)
      if (complexityError) {
        return context.render(
          <ResetFormPage token={token} error={complexityError} errors={{ password: complexityError }} />,
          { status: 400 },
        )
      }

      let result = await validateResetToken(context.db, token)
      if (result.error) {
        return context.render(<ResetErrorPage title={result.error.title} message={result.error.message} />, { status: 400 })
      }

      let currentUser = await context.db.find(users, result.user.id) as { token_version: number } | undefined

      await context.db.update(users, result.user.id, {
        password_hash: await hashPassword(parsed.value.password),
        token_version: (currentUser?.token_version ?? 0) + 1,
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
        session.regenerateId(true)
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

// ── Verify ──

const verifyLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 10 })

export async function verify(context: AppContext) {
  let ip = sourceIp(context.request) || 'unknown'
  if (!verifyLimiter.attempt(ip)) {
    return context.render(<VerifyErrorPage title="Too many attempts" message="You have made too many verification attempts. Please try again later." />, { status: 429 })
  }
  let token = (context.params as Record<string, string>).token

  let user = await context.db.findOne(users, { where: { verification_token: token } })
  if (!user) {
    return context.render(<VerifyErrorPage title="Invalid verification link" message="This verification link is invalid or has already been used." />, { status: 400 })
  }

  if (user.verification_expires != null && user.verification_expires < Date.now()) {
    return context.render(<VerifyErrorPage title="Link expired" message="This verification link has expired. Please register again to receive a new link." />, { status: 400 })
  }

  await context.db.update(users, user.id, {
    email_verified: 1,
    verification_token: null as unknown as string,
    verification_expires: null as unknown as number,
  })

  let session = context.session
  if (session) {
    session.flash('verified', 'Email verified successfully! Please log in.')
  }

  return redirect(routes.auth.login.index.href())
}

// ── Logout ──

export const authLogout = createAction(routes.auth.logout, () => {
  let session = getContext().session
  if (session == null) {
    throw new Error('Expected session() middleware before auth logout')
  }
  session.unset('auth')
  session.regenerateId(true)
  return redirect(routes.home.href())
})
