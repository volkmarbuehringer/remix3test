import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

import { requireAuth } from '../../middleware/auth.ts'
import { users } from '../../data/schema.ts'
import { hashPassword, verifyPassword } from '../../utils/password-hash.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageSection, bodyTextCss, panelCss } from '../../ui/page-primitives.tsx'
import { fieldLabelCss, fieldErrorCss, inputWrapperCss, inputHasToggleCss, toggleButtonCss } from '../../ui/auth-card.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { input } from '../../ui/mixins/input.ts'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { PasswordToggle } from '../../assets/password-toggle.tsx'

const changePasswordLimiter = createRateLimiter({ windowMs: 15_000, perUser: true, maxAttempts: 5 })

const changePasswordSchema = f.object({
  currentPassword: f.field(s.string()),
  newPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string()),
})

export default createController(routes.settings, {
  middleware: [requireAuth()],
  actions: {
    index(context) {
      let user = getCurrentUser()
      return context.render(<SettingsPage />)
    },

    async action(context) {
      let user = getCurrentUser()

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsPage error="Too many attempts. Please try again later." />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(changePasswordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <SettingsPage error="Please check your input." errors={issuesToFieldErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let { currentPassword, newPassword, confirmPassword } = parsed.value

      let valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) {
        return context.render(
          <SettingsPage error="Current password is incorrect." errors={{ currentPassword: 'Incorrect password' }} />,
          { status: 400 },
        )
      }

      if (newPassword !== confirmPassword) {
        return context.render(
          <SettingsPage error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(newPassword)
      if (complexityError) {
        return context.render(
          <SettingsPage error={complexityError} errors={{ newPassword: complexityError }} />,
          { status: 400 },
        )
      }

      await context.db.update(users, user.id, {
        password_hash: await hashPassword(newPassword),
      })

      let session = context.session
      if (session) {
        session.regenerateId()
      }

      changePasswordLimiter.reset(user.id)

      return context.render(<SettingsPage success="Password updated successfully." />)
    },
  },
})

type SettingsPageProps = {
  error?: string
  errors?: Record<string, string | undefined>
  success?: string
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { error, errors, success } = handle.props

    return (
      <Layout title="Settings">
        <PageSection title="Settings" description="Manage your account settings.">
          <div mix={panelCss}>
            <h2 mix={sectionTitleCss}>Password ändern</h2>
            {error ? <p role="alert" mix={errorBanner}>{error}</p> : null}
            {success ? <p role="status" mix={successBanner}>{success}</p> : null}
            <form action={routes.settings.action.href()} method="POST" mix={formContainer}>
              <CsrfTokenInput />
              <PasswordToggle />
              <label mix={fieldLabelCss}>
                <span>Current password</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    autoComplete="current-password"
                    aria-invalid={errors?.currentPassword ? true : undefined}
                    aria-describedby={errors?.currentPassword ? 'current-password-error' : undefined}
                    mix={[input.base, input.focus, errors?.currentPassword ? input.error : undefined, inputHasToggleCss]}
                  />
                  <button type="button" data-toggle-pw="currentPassword" aria-label="Show password" mix={toggleButtonCss}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                {errors?.currentPassword ? <span id="current-password-error" role="alert" mix={fieldErrorCss}>{errors.currentPassword}</span> : null}
              </label>

              <label mix={fieldLabelCss}>
                <span>New password</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="newPassword"
                    required
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    aria-invalid={errors?.newPassword ? true : undefined}
                    aria-describedby={errors?.newPassword ? 'new-password-error' : undefined}
                    mix={[input.base, input.focus, errors?.newPassword ? input.error : undefined, inputHasToggleCss]}
                  />
                  <button type="button" data-toggle-pw="newPassword" aria-label="Show password" mix={toggleButtonCss}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                {errors?.newPassword ? <span id="new-password-error" role="alert" mix={fieldErrorCss}>{errors.newPassword}</span> : null}
                <div data-pw-complexity mix={complexityFeedbackCss}></div>
                <script>{`document.addEventListener('input',e=>{let i=e.target;if(i.name!=='newPassword')return;let f=i.closest('form');if(!f)return;let g=f.querySelector('[data-pw-complexity]');if(!g)return;let v=i.value;g.innerHTML=[['At least 10 characters',v.length>=10],['At least one number (0-9)',/[0-9]/.test(v)],['At least one special character',/[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?\`~]/.test(v)]].map(r=>'<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:'+(r[1]?'#16a34a':'#6b7280')+'">'+(r[1]?'\\u2713':'\\u25CB')+' '+r[0]+'</span>').join('')})`}</script>
              </label>

              <label mix={fieldLabelCss}>
                <span>Confirm new password</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
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

              <button type="submit" mix={submitButton}>Save</button>
            </form>
          </div>
        </PageSection>
      </Layout>
    )
  }
}

const sectionTitleCss = css({
  margin: '0 0 1rem',
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const formContainer = css({
  display: 'grid',
  gap: theme.space.md,
})

const complexityFeedbackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginTop: theme.space.xs,
})

const errorBanner = css({
  backgroundColor: theme.colors.action.danger.background,
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.foreground,
  margin: 0,
  padding: theme.space.md,
})

const successSurface = theme.surface as Record<string, string>
const successBanner = css({
  backgroundColor: successSurface.successBg ?? '#d1fae5',
  border: `1px solid ${successSurface.successBorder ?? '#6ee7b7'}`,
  borderRadius: theme.radius.md,
  color: successSurface.successText ?? '#065f46',
  margin: 0,
  padding: theme.space.md,
})

const submitButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1.5rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: 'white',
  background: theme.colors.action.primary.background,
  border: 'none',
  borderRadius: theme.radius.md,
  cursor: 'pointer',
  transition: 'all 150ms ease',
  '&:hover': {
    opacity: 0.9,
  },
})
