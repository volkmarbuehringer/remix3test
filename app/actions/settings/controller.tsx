import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Glyph } from 'remix/ui/glyph'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

import { requireAuth } from '../../middleware/auth.ts'
import { users } from '../../data/schema.ts'
import { hashPassword, verifyPassword } from '../../utils/password-hash.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { pool } from '../../data/setup.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageSection, bodyTextCss, panelCss } from '../../ui/page-primitives.tsx'
import { fieldLabelCss, fieldErrorCss, inputWrapperCss, inputHasToggleCss, toggleButtonCss } from '../../ui/auth-card.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { input } from '../../ui/mixins/input.ts'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { PasswordToggle } from '../../assets/password-toggle.tsx'

const changePasswordLimiter = createRateLimiter({ windowMs: 15_000, perUser: true, maxAttempts: 5 })

const deleteAccountLimiter = createRateLimiter({ windowMs: 60_000, perUser: true, maxAttempts: 3 })

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
      let _action =
        typeof context.formData.get('_action') === 'string'
          ? (context.formData.get('_action') as string)
          : undefined

      if (_action === 'delete-account') {
        if (user.role === 'admin') {
          return context.render(
            <SettingsPage deleteError="Administratoren können ihr Konto nicht selbst löschen." />,
            { status: 403 },
          )
        }

        if (!deleteAccountLimiter.attempt(user.id)) {
          return context.render(
            <SettingsPage deleteError="Zu viele Versuche. Bitte versuchen Sie es später erneut." />,
            { status: 429 },
          )
        }

        let inputPassword =
          typeof context.formData.get('currentPassword') === 'string'
            ? (context.formData.get('currentPassword') as string)
            : ''
        let passwordValid = await verifyPassword(inputPassword, user.password_hash)
        if (!passwordValid) {
          return context.render(
            <SettingsPage
              deleteError="Aktuelles Passwort ist falsch."
            />,
            { status: 400 },
          )
        }

        try {
          await logAdminAction(pool, {
            admin_user_id: user.id,
            admin_email: user.email,
            action_type: 'self-delete',
            target_type: 'users',
            target_id: user.id,
          })
        } catch {
          // Non-blocking: audit log failure should not prevent account deletion
        }

        let client = await pool.connect()
        try {
          await client.query('BEGIN')
          await client.query('UPDATE messages SET sender_id = NULL WHERE sender_id = $1', [user.id])
          await client.query('UPDATE workflow_runs SET created_by = NULL WHERE created_by = $1', [user.id])
          await client.query('DELETE FROM users WHERE id = $1', [user.id])
          await client.query('COMMIT')
        } catch (err) {
          await client.query('ROLLBACK')
          deleteAccountLimiter.reset(user.id)
          return context.render(
            <SettingsPage deleteError="Konto konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut." />,
            { status: 500 },
          )
        } finally {
          client.release()
        }

        let session = context.session
        if (session) {
          session.regenerateId(true)
        }

        return new Response(null, {
          status: 302,
          headers: { Location: routes.auth.login.index.href() },
        })
      }

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsPage passwordError="Zu viele Versuche. Bitte versuchen Sie es später erneut." />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(changePasswordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <SettingsPage passwordError="Bitte überprüfen Sie Ihre Eingabe." passwordErrors={issuesToFieldErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let { currentPassword, newPassword, confirmPassword } = parsed.value

      let valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) {
        return context.render(
          <SettingsPage passwordError="Aktuelles Passwort ist falsch." passwordErrors={{ currentPassword: 'Falsches Passwort' }} />,
          { status: 400 },
        )
      }

      if (newPassword !== confirmPassword) {
        return context.render(
          <SettingsPage passwordError="Passwörter stimmen nicht überein." passwordErrors={{ confirmPassword: 'Passwörter stimmen nicht überein' }} />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(newPassword)
      if (complexityError) {
        return context.render(
          <SettingsPage passwordError={complexityError} passwordErrors={{ newPassword: complexityError }} />,
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

      return context.render(<SettingsPage passwordSuccess="Passwort erfolgreich aktualisiert." />)
    },
  },
})

type SettingsPageProps = {
  passwordError?: string
  passwordErrors?: Record<string, string | undefined>
  passwordSuccess?: string
  deleteError?: string
  deleteSuccess?: string
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { passwordError, passwordErrors, passwordSuccess, deleteError, deleteSuccess } = handle.props

    return (
      <Layout title="Einstellungen">
        <PageSection title="Einstellungen" description="Verwalten Sie Ihre Kontoeinstellungen.">
          <div mix={panelCss}>
            <h2 mix={sectionTitleCss}>Passwort ändern</h2>
            {passwordError ? <p role="alert" mix={errorBanner}>{passwordError}</p> : null}
            {passwordSuccess ? <p role="status" mix={successBanner}>{passwordSuccess}</p> : null}
            <form action={routes.settings.action.href()} method="POST" mix={formContainer}>
              <CsrfTokenInput />
              <PasswordToggle />
              <label mix={fieldLabelCss}>
                <span>Aktuelles Passwort</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    autoComplete="current-password"
                    aria-invalid={passwordErrors?.currentPassword ? true : undefined}
                    aria-describedby={passwordErrors?.currentPassword ? 'current-password-error' : undefined}
                    mix={[input.base, input.focus, passwordErrors?.currentPassword ? input.error : undefined, inputHasToggleCss]}
                  />
                  <button type="button" data-toggle-pw="currentPassword" aria-label="Passwort anzeigen" mix={toggleButtonCss}>
                    <Glyph name="eye" width={18} height={18} />
                  </button>
                </div>
                {passwordErrors?.currentPassword ? <span id="current-password-error" role="alert" mix={fieldErrorCss}>{passwordErrors.currentPassword}</span> : null}
              </label>

              <label mix={fieldLabelCss}>
                <span>Neues Passwort</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="newPassword"
                    required
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    aria-invalid={passwordErrors?.newPassword ? true : undefined}
                    aria-describedby={passwordErrors?.newPassword ? 'new-password-error' : undefined}
                    mix={[input.base, input.focus, passwordErrors?.newPassword ? input.error : undefined, inputHasToggleCss]}
                  />
                  <button type="button" data-toggle-pw="newPassword" aria-label="Passwort anzeigen" mix={toggleButtonCss}>
                    <Glyph name="eye" width={18} height={18} />
                  </button>
                </div>
                {passwordErrors?.newPassword ? <span id="new-password-error" role="alert" mix={fieldErrorCss}>{passwordErrors.newPassword}</span> : null}
                <div data-pw-complexity mix={complexityFeedbackCss}></div>
                <script>{`document.addEventListener('input',e=>{let i=e.target;if(i.name!=='newPassword')return;let f=i.closest('form');if(!f)return;let g=f.querySelector('[data-pw-complexity]');if(!g)return;let v=i.value;g.innerHTML=[['Mindestens 10 Zeichen',v.length>=10],['Mindestens eine Zahl (0-9)',/[0-9]/.test(v)],['Mindestens ein Sonderzeichen',/[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?\`~]/.test(v)]].map(r=>'<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:'+(r[1]?'#16a34a':'#6b7280')+'">'+(r[1]?'\\u2713':'\\u25CB')+' '+r[0]+'</span>').join('')})`}</script>
              </label>

              <label mix={fieldLabelCss}>
                <span>Neues Passwort bestätigen</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                    aria-invalid={passwordErrors?.confirmPassword ? true : undefined}
                    aria-describedby={passwordErrors?.confirmPassword ? 'confirm-password-error' : undefined}
                    mix={[input.base, input.focus, passwordErrors?.confirmPassword ? input.error : undefined, inputHasToggleCss]}
                  />
                  <button type="button" data-toggle-pw="confirmPassword" aria-label="Passwort anzeigen" mix={toggleButtonCss}>
                    <Glyph name="eye" width={18} height={18} />
                  </button>
                </div>
                {passwordErrors?.confirmPassword ? <span id="confirm-password-error" role="alert" mix={fieldErrorCss}>{passwordErrors.confirmPassword}</span> : null}
              </label>

              <button type="submit" mix={submitButton}>Speichern</button>
            </form>
          </div>

          <div mix={[panelCss, deletePanelCss]}>
            <h2 mix={sectionTitleCss}>Konto löschen</h2>
            <p mix={warningTextCss}>Diese Aktion löscht Ihr Konto und alle zugehörigen Daten dauerhaft. Dies kann nicht rückgängig gemacht werden.</p>
            {deleteError ? <p role="alert" mix={errorBanner}>{deleteError}</p> : null}
            {deleteSuccess ? <p role="status" mix={successBanner}>{deleteSuccess}</p> : null}
            <form action={routes.settings.action.href()} method="POST" mix={formContainer}>
              <input type="hidden" name="_action" value="delete-account" />
              <CsrfTokenInput />
              <label mix={fieldLabelCss}>
                <span>Passwort eingeben zur Bestätigung</span>
                <div mix={inputWrapperCss}>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    autoComplete="current-password"
                    mix={[input.base, input.focus]}
                  />
                </div>
              </label>
              <label mix={confirmLabelCss}>
                <input type="checkbox" name="confirmDelete" required />
                <span>Wollen Sie wirklich löschen?</span>
              </label>
              <button type="submit" mix={deleteButtonCss}>Konto löschen</button>
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

const deletePanelCss = css({
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.lg,
  marginTop: theme.space.xl,
})

const warningTextCss = css({
  color: theme.colors.action.danger.foreground,
  fontSize: theme.fontSize.sm,
  marginBottom: theme.space.md,
  lineHeight: 1.5,
})

const deleteButtonCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1.5rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: 'white',
  background: theme.colors.action.danger.background,
  border: 'none',
  borderRadius: theme.radius.md,
  cursor: 'pointer',
  transition: 'all 150ms ease',
  '&:hover': {
    opacity: 0.9,
  },
})

const confirmLabelCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
})
