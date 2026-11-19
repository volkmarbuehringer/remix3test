import { verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import { email as emailCheck, minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { getContext } from 'remix/middleware/async-context'
import { createAction, createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminActionStrict } from '../../data/audit-log.ts'
import { apiTokens, users } from '../../data/schema.ts'
import { passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginFailures,
  __resetLoginRateLimits,
  type LoginBlockReason,
} from '../../utils/login-rate-limit.ts'
import { getSafeReturnTo } from '../../utils/redirect.ts'
import { issuesToFieldErrors, readFormFieldValues, trimmedText } from '../../utils/schema-utils.ts'
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAlreadyRegisteredEmail,
} from '../../utils/send-email.ts'
import { generateToken, resetExpires, verificationExpires } from '../../utils/verification-token.ts'
import { hashToken } from '../../utils/api-token.ts'
import { isUniqueViolation } from '../../utils/db-errors.ts'
import { connectionIp } from '../../utils/request-ip.ts'
import { getPublicOrigin } from '../../utils/public-origin.ts'
import { logSecurityEvent } from '../../data/security-events.ts'
import { getCurrentUserSafely } from '../../utils/context.ts'

import {
  LoginPage,
  RegisterPage,
  RegisterSentPage,
  ForgotPage,
  ForgotSentPage,
  ResetFormPage,
  ResetErrorPage,
  VerifyErrorPage,
} from './pages.tsx'
import { flashSuccess } from '../../utils/flash.ts'

// ── Login ──

const loginSchema = f.object({
  email: f.field(s.defaulted(trimmedText(), '').pipe(emailCheck())),
  password: f.field(s.defaulted(s.string(), '')),
})

// The login lockout state is shared with /api/login (see login-rate-limit.ts),
// so both endpoints enforce the same escalating per-account tiers.
const LOGIN_BLOCK_MESSAGES: Record<LoginBlockReason, string> = {
  long: 'Account is locked due to too many failed attempts. Please try again later.',
  medium: 'Account is temporarily locked. Please try again in a few minutes.',
  short: 'Too many attempts. Please try again later.',
  ip: 'Too many attempts from this IP. Please try again later.',
}

/**
 * Test-only helper retained for the auth journey tests. Clears all shared login
 * lockout state (email tiers and the IP bucket) so tests that reuse seed
 * accounts are deterministic. Not used in production request paths.
 */
export function __resetAuthRateLimits(_email: string): void {
  __resetLoginRateLimits()
}

export const authLogin = createController(routes.auth.login, {
  middleware: [],
  actions: {
    index(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      return context.render(<LoginPage returnTo={returnTo} />)
    },

    async action(context) {
      let returnTo = context.url.searchParams.get('returnTo') ?? undefined
      // Guide 09 "Return validation failures with the form": re-render with the
      // submitted email so a failed sign-in does not clear the field. The
      // password is never echoed.
      let values = { email: readFormFieldValues(['email'], context.formData).email }

      let parsed = s.parseSafe(loginSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <LoginPage
            error="Invalid email or password format."
            errors={issuesToFieldErrors(parsed.issues)}
            returnTo={returnTo}
            values={values}
          />,
          { status: 400 },
        )
      }

      let ip = connectionIp(context.request)
      let email = parsed.value.email.toLowerCase()
      let block = checkLoginRateLimit(parsed.value.email, ip)
      if (block) {
        await logSecurityEvent(context.db, {
          event_type: 'login_locked',
          email,
          ip,
          details: { reason: block.reason },
        })
        return context.render(
          <LoginPage
            error={LOGIN_BLOCK_MESSAGES[block.reason]}
            returnTo={returnTo}
            values={values}
          />,
          {
            status: 429,
          },
        )
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (user == null) {
        recordLoginFailure(parsed.value.email, ip)
        await logSecurityEvent(context.db, { event_type: 'login_failed', email, ip })
        return context.render(
          <LoginPage error="Invalid email or password." returnTo={returnTo} values={values} />,
          { status: 401 },
        )
      }

      resetLoginFailures(parsed.value.email)

      let session = completeAuth(context)
      session.set('auth', { userId: user.id, tv: user.token_version })

      await logSecurityEvent(context.db, {
        event_type: 'login_success',
        user_id: user.id,
        email: user.email,
        ip,
      })

      returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? '/'
      return redirect(returnTo, 303)
    },
  },
})

// ── Register ──

const registerLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })

const REGISTER_FORM_KEYS = ['name', 'email'] as const

const registerSchema = f.object({
  name: f.field(trimmedText().pipe(minLength(8))),
  email: f.field(trimmedText().pipe(emailCheck())),
  password: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
})

export const authRegister = createController(routes.auth.register, {
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
        return context.render(
          <RegisterPage
            error={`Ungültige Eingabe. Der Name muss mindestens 8 Zeichen lang sein, die E-Mail-Adresse muss gültig sein und das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`}
            errors={issuesToFieldErrors(parsed.issues)}
            formValues={formValues}
          />,
          { status: 400 },
        )
      }
      let { name, email, password } = parsed.value

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <RegisterPage
            error="Die Passwörter stimmen nicht überein."
            errors={{ confirmPassword: 'Die Passwörter stimmen nicht überein.' }}
            formValues={formValues}
          />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(password)
      if (complexityError) {
        return context.render(
          <RegisterPage
            error={complexityError}
            errors={{ password: complexityError }}
            formValues={formValues}
          />,
          { status: 400 },
        )
      }

      let normalizedEmail = email.trim().toLowerCase()

      if (!registerLimiter.attempt(normalizedEmail)) {
        return context.render(
          <RegisterPage
            error="Zu viele Registrierungsversuche. Bitte versuchen Sie es später erneut."
            formValues={formValues}
          />,
          { status: 429 },
        )
      }

      let existing = await context.db.findOne(users, { where: { email: normalizedEmail } })
      if (existing) {
        return await respondAlreadyRegistered(context, existing, password)
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
            // M1: only the SHA-256 hash is stored; the raw token lives solely in
            // the emailed link, so a DB read cannot yield a usable link.
            verification_token: hashToken(token),
            verification_expires: expires,
            created_at: Date.now(),
          },
          { returnRow: true },
        )
      } catch (err) {
        if (isUniqueViolation(err)) {
          // Lost the race with a concurrent registration: same enumeration-safe
          // response as the pre-check above.
          let winner = await context.db.findOne(users, { where: { email: normalizedEmail } })
          return await respondAlreadyRegistered(context, winner, password)
        }
        throw err
      }

      registerLimiter.reset(normalizedEmail)

      if (process.env.NODE_ENV !== 'test') {
        let verificationUrl = `${getPublicOrigin(context.url.origin)}${routes.auth.verify.href({ token })}`
        try {
          await sendVerificationEmail(
            context.mailer,
            { name: user.name, email: user.email },
            verificationUrl,
          )
        } catch (err) {
          context.logger?.('Failed to send verification email: ' + String(err))
          return context.render(
            <RegisterPage
              error="Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut."
              formValues={formValues}
            />,
            { status: 500 },
          )
        }
      }

      return redirect(routes.auth.registerSent.href(), 303)
    },
  },
})

export async function registerSent(context: AppContext) {
  return context.render(<RegisterSentPage />)
}

/**
 * Enumeration-safe response for an email that already has an account (M5).
 * Identical to a successful registration (303 -> register-sent); the account
 * owner is notified by email instead of the response revealing existence. A
 * dummy PBKDF2 hash equalizes the dominant timing cost with the create path so
 * response time cannot be used as an oracle either. The rate limiter is
 * deliberately NOT reset, so repeated probes still throttle.
 */
async function respondAlreadyRegistered(
  context: AppContext,
  existing: { name: string; email: string } | null | undefined,
  password: string,
): Promise<Response> {
  await hashPassword(password)
  if (existing && process.env.NODE_ENV !== 'test') {
    try {
      await sendAlreadyRegisteredEmail(context.mailer, existing)
    } catch (err) {
      context.logger?.('Failed to send already-registered email: ' + String(err))
    }
  }
  return redirect(routes.auth.registerSent.href(), 303)
}

// ── Forgot / Reset ──

const forgotLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })
const resetLimiter = createRateLimiter({ windowMs: 15 * 60_000, perKey: true, maxAttempts: 5 })

const emailSchema = f.object({
  email: f.field(trimmedText().pipe(emailCheck())),
})

const passwordSchema = f.object({
  password: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
})

export const authForgotten = createController(routes.auth.forgotten, {
  middleware: [],
  actions: {
    index(context) {
      // PRG destination for a submitted reset request (guide 09 "Redirect after
      // saving"): a refresh repeats this GET instead of regenerating the token
      // and re-sending the email.
      if (context.url.searchParams.get('sent') === '1') {
        return context.render(<ForgotSentPage />)
      }
      return context.render(<ForgotPage />)
    },

    async action(context) {
      let values = { email: readFormFieldValues(['email'], context.formData).email }
      let parsed = s.parseSafe(emailSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <ForgotPage
            error="Bitte geben Sie eine gültige E-Mail-Adresse ein."
            errors={issuesToFieldErrors(parsed.issues)}
            values={values}
          />,
          { status: 400 },
        )
      }

      let normalizedEmail = parsed.value.email.trim().toLowerCase()

      if (!forgotLimiter.attempt(normalizedEmail)) {
        return context.render(
          <ForgotPage
            error="Zu viele Versuche. Bitte versuchen Sie es später erneut."
            values={values}
          />,
          { status: 429 },
        )
      }

      let user = await context.db.findOne(users, { where: { email: normalizedEmail } })
      if (user) {
        let token = generateToken()
        let expires = resetExpires()

        await context.db.update(users, user.id, {
          // M1: store only the hash; the raw token lives solely in the emailed link.
          password_reset_token: hashToken(token),
          password_reset_expires: expires,
        })

        let resetUrl = `${getPublicOrigin(context.url.origin)}${routes.auth.forgottenReset.index.href({ token })}`
        try {
          await sendPasswordResetEmail(
            context.mailer,
            { name: user.name, email: user.email },
            resetUrl,
          )
        } catch (err) {
          context.logger?.('Failed to send password reset email: ' + String(err))
        }
      }

      return redirect(routes.auth.forgotten.index.href() + '?sent=1', 303)
    },
  },
})

export const authForgottenReset = createController(routes.auth.forgottenReset, {
  middleware: [],
  actions: {
    async index(context) {
      let token = (context.params as Record<string, string>).token
      let result = await validateResetToken(context.db, token)
      if (result.error) {
        return context.render(
          <ResetErrorPage title={result.error.title} message={result.error.message} />,
          { status: 400 },
        )
      }
      return context.render(<ResetFormPage token={token!} />)
    },

    async action(context) {
      let token = (context.params as Record<string, string>).token

      if (!resetLimiter.attempt(token)) {
        try {
          let userByToken = await context.db.findOne(users, {
            where: { password_reset_token: hashToken(token ?? '') },
          })
          if (userByToken) {
            await context.db.update(users, (userByToken as { id: number }).id, {
              password_reset_token: null,
              password_reset_expires: null,
            })
          }
        } catch {
          // Token invalidation is best-effort; rate limit error takes priority
        }
        return context.render(
          <ResetErrorPage
            title="Zu viele Versuche"
            message="Zu viele Versuche. Bitte fordern Sie einen neuen Link an."
          />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(passwordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <ResetFormPage
            token={token!}
            error={`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`}
            errors={issuesToFieldErrors(parsed.issues)}
          />,
          { status: 400 },
        )
      }

      if (parsed.value.password !== parsed.value.confirmPassword) {
        return context.render(
          <ResetFormPage
            token={token!}
            error="Die Passwörter stimmen nicht überein."
            errors={{ confirmPassword: 'Die Passwörter stimmen nicht überein.' }}
          />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(parsed.value.password)
      if (complexityError) {
        return context.render(
          <ResetFormPage
            token={token!}
            error={complexityError}
            errors={{ password: complexityError }}
          />,
          { status: 400 },
        )
      }

      let result = await validateResetToken(context.db, token)
      if (result.error) {
        return context.render(
          <ResetErrorPage title={result.error.title} message={result.error.message} />,
          { status: 400 },
        )
      }

      let currentUser = (await context.db.find(users, result.user.id)) as
        | { token_version: number }
        | undefined

      // Compute the hash before opening the transaction so bcrypt does not
      // hold the transaction connection (~100 ms).
      let passwordHash = await hashPassword(parsed.value.password)

      // Credential rotation and session invalidation are one transaction: a
      // failed API-token wipe must roll the password change back with it, and
      // the audit row shares the mutation's fate (logAdminActionStrict).
      await context.db.transaction(async (tx) => {
        await tx.update(users, result.user.id, {
          password_hash: passwordHash,
          token_version: (currentUser?.token_version ?? 0) + 1,
          password_reset_token: null,
          password_reset_expires: null,
        })
        await tx.deleteMany(apiTokens, { where: { user_id: result.user.id } })

        await logAdminActionStrict(tx, {
          admin_user_id: result.user.id,
          admin_email: result.user.email,
          action_type: 'password_reset_self',
          target_type: 'user',
          target_id: result.user.id,
        })
      })

      let session = context.session
      if (session) {
        session.regenerateId(true)
        session.unset('auth')
        flashSuccess(session, 'Password reset successfully! Please log in.')
      }

      return redirect(routes.auth.login.index.href(), 303)
    },
  },
})

async function validateResetToken(
  db: AppContext['db'],
  token?: string,
): Promise<
  | { error: { title: string; message: string } }
  | { error: null; user: { id: number; email: string } }
> {
  if (!token) {
    return { error: { title: 'Invalid reset link', message: 'This reset link is invalid.' } }
  }

  let user = await db.findOne(users, { where: { password_reset_token: hashToken(token) } })
  if (!user) {
    return {
      error: {
        title: 'Invalid reset link',
        message: 'This reset link is invalid or has already been used.',
      },
    }
  }

  if (user.password_reset_expires != null && user.password_reset_expires < Date.now()) {
    return {
      error: {
        title: 'Link expired',
        message: 'This reset link has expired. Please request a new one.',
      },
    }
  }

  return { error: null, user: { id: user.id, email: user.email } }
}

// ── Verify ──

const verifyLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 10 })

export async function verify(context: AppContext) {
  let ip = connectionIp(context.request) || 'unknown'
  if (!verifyLimiter.attempt(ip)) {
    return context.render(
      <VerifyErrorPage
        title="Too many attempts"
        message="You have made too many verification attempts. Please try again later."
      />,
      { status: 429 },
    )
  }
  let token = (context.params as Record<string, string>).token

  // M1: the column stores only the hash; compare against the hash of the raw
  // token from the link.
  let user = token
    ? await context.db.findOne(users, { where: { verification_token: hashToken(token) } })
    : undefined
  if (!user) {
    return context.render(
      <VerifyErrorPage
        title="Invalid verification link"
        message="This verification link is invalid or has already been used."
      />,
      { status: 400 },
    )
  }

  if (user.verification_expires != null && user.verification_expires < Date.now()) {
    return context.render(
      <VerifyErrorPage
        title="Link expired"
        message="This verification link has expired. Please register again to receive a new link."
      />,
      { status: 400 },
    )
  }

  await context.db.update(users, user.id, {
    email_verified: 1,
    verification_token: null,
    verification_expires: null,
  })

  let session = context.session
  if (session) {
    // `flashSuccess` keeps this on the shared `success` tone the login page's
    // banner reads; a bespoke key would not render and would be dropped by the
    // session merge.
    flashSuccess(session, 'Email verified successfully! Please log in.')
  }

  return redirect(routes.auth.login.index.href())
}

// ── Logout ──

export const authLogout = createAction(routes.auth.logout, async () => {
  let context = getContext()
  let session = context.session
  if (session == null) {
    throw new Error('Expected session() middleware before auth logout')
  }
  let user = getCurrentUserSafely()
  session.unset('auth')
  session.regenerateId(true)
  await logSecurityEvent(context.db, {
    event_type: 'logout',
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    ip: connectionIp(context.request),
  })
  return redirect(routes.home.href(), 303)
})
