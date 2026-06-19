import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../lib/theme.ts'
import { Glyph } from '../../lib/glyph.ts'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'

import { requireAuth } from '../../middleware/auth.ts'
import { users, type User } from '../../data/schema.ts'
import { hashPassword, verifyPassword } from '../../utils/password-hash.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { getPageSize, VALID_PAGE_SIZES } from '../../utils/get-page-size.ts'
import { pool } from '../../data/setup.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageSection, panelCss } from '../../ui/page-primitives.tsx'
import { fieldLabelCss, fieldErrorCss, inputWrapperCss, inputHasToggleCss, toggleButtonCss } from '../../ui/auth-card.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { sendAccountDeletionEmail } from '../../utils/send-email.ts'
import { input } from '../../ui/mixins/input.ts'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { Logger } from 'remix/middleware/logger'
import { PasswordToggle } from '../../assets/password-toggle.tsx'

const changePasswordLimiter = createRateLimiter({ windowMs: 15_000, perUser: true, maxAttempts: 5 })

const deleteAccountLimiter = createRateLimiter({ windowMs: 60_000, perUser: true, maxAttempts: 3 })

const changePasswordSchema = f.object({
  currentPassword: f.field(s.string()),
  newPassword: f.field(s.string().pipe(minLength(PASSWORD_MIN_LENGTH))),
  confirmPassword: f.field(s.string()),
})

import type { AppContext } from '../../types/context.ts'

export default createController<typeof routes.settings, AppContext>(routes.settings, {
  middleware: [requireAuth()],
  actions: {
    index(context) {
      let user = getCurrentUser()
      let pageSize = getPageSize(context.session, 15)
      return context.render(<SettingsPage user={user} pageSize={pageSize} />)
    },

    async action(context) {
      let user = getCurrentUser()
      let pageSize = getPageSize(context.session, 15)
      let _action =
        typeof context.formData.get('_action') === 'string'
          ? (context.formData.get('_action') as string)
          : undefined

      if (_action === 'delete-account') {
        if (user.role === 'admin') {
          return context.render(
            <SettingsPage user={user} pageSize={pageSize} deleteError="Administratoren können ihr Konto nicht selbst löschen." />,
            { status: 403 },
          )
        }

        if (!deleteAccountLimiter.attempt(user.id)) {
          return context.render(
            <SettingsPage user={user} pageSize={pageSize} deleteError="Zu viele Versuche. Bitte versuchen Sie es später erneut." />,
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
            <SettingsPage user={user} pageSize={pageSize}
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

        try {
          await pool.query('DELETE FROM users WHERE id = $1', [user.id])
        } catch (err) {
          deleteAccountLimiter.reset(user.id)
          return context.render(
            <SettingsPage user={user} pageSize={pageSize} deleteError="Konto konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut." />,
            { status: 500 },
          )
        }

        let session = context.session
        if (session) {
          session.regenerateId(true)
        }

        if (process.env.NODE_ENV !== 'test') {
          try {
            await sendAccountDeletionEmail(context.mailer, { name: user.name, email: user.email }, 'self')
          } catch (err) {
            context.get(Logger)?.('Failed to send account deletion email: ' + String(err))
          }
        }

        return redirect(routes.auth.login.index.href())
      }

      if (_action === 'set-page-size') {
        let session = context.session
        if (session) {
          let raw = context.formData.get('pageSize')
          let pageSize = typeof raw === 'string' ? Number(raw) : NaN
          if (!isNaN(pageSize) && (VALID_PAGE_SIZES as readonly number[]).includes(pageSize)) {
            session.set('pageSize', pageSize)
          }
        }
        return redirect(routes.settings.index.href())
      }

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsPage user={user} pageSize={pageSize} passwordError="Zu viele Versuche. Bitte versuchen Sie es später erneut." />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(changePasswordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <SettingsPage user={user} pageSize={pageSize} passwordError="Bitte überprüfen Sie Ihre Eingabe." passwordErrors={issuesToFieldErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let { currentPassword, newPassword, confirmPassword } = parsed.value

      let valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) {
        return context.render(
          <SettingsPage user={user} pageSize={pageSize} passwordError="Aktuelles Passwort ist falsch." passwordErrors={{ currentPassword: 'Falsches Passwort' }} />,
          { status: 400 },
        )
      }

      if (newPassword !== confirmPassword) {
        return context.render(
          <SettingsPage user={user} pageSize={pageSize} passwordError="Passwörter stimmen nicht überein." passwordErrors={{ confirmPassword: 'Passwörter stimmen nicht überein' }} />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(newPassword)
      if (complexityError) {
        return context.render(
          <SettingsPage user={user} pageSize={pageSize} passwordError={complexityError} passwordErrors={{ newPassword: complexityError }} />,
          { status: 400 },
        )
      }

      let newTv = (user as { token_version?: number }).token_version ?? 0

      await context.db.update(users, user.id, {
        password_hash: await hashPassword(newPassword),
        token_version: newTv + 1,
      })

      let session = context.session
      if (session) {
        session.regenerateId(true)
        session.set('auth', { userId: user.id, tv: newTv + 1 })
      }

      changePasswordLimiter.reset(user.id)

      return context.render(<SettingsPage user={user} pageSize={pageSize} passwordSuccess="Passwort erfolgreich aktualisiert." />)
    },
  },
})

type SettingsPageProps = {
  user: User
  pageSize: number
  passwordError?: string
  passwordErrors?: Record<string, string | undefined>
  passwordSuccess?: string
  deleteError?: string
  deleteSuccess?: string
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { user, pageSize, passwordError, passwordErrors, passwordSuccess, deleteError, deleteSuccess } = handle.props

    return (
      <Layout title="Einstellungen">
        <PageSection title="Einstellungen" description="Verwalten Sie Ihre Kontoeinstellungen.">
          <div mix={panelCss}>
            <div mix={profileGridCss}>
              <div mix={profileFieldCss}>
                <span mix={profileLabelCss}>Name</span>
                <span mix={profileValueCss}>{user.name}</span>
              </div>
              <div mix={profileFieldCss}>
                <span mix={profileLabelCss}>E-Mail</span>
                <span mix={profileValueCss}>{user.email}</span>
              </div>
            </div>
          </div>

          <div mix={panelCss}>
            <h2 mix={sectionTitleCss}>Anzeige</h2>
            <p mix={hintTextCss}>Gilt für alle Listen während dieser Sitzung.</p>
            <form action={routes.settings.action.href()} method="POST">
              <input type="hidden" name="_action" value="set-page-size" />
              <CsrfTokenInput />
              <div mix={formContainer}>
                <label mix={fieldLabelCss}>
                  <span>Einträge pro Seite</span>
                  <select name="pageSize" mix={selectCss}>
                    <option value={10} selected={pageSize === 10}>10</option>
                    <option value={15} selected={pageSize === 15}>15</option>
                    <option value={20} selected={pageSize === 20}>20</option>
                    <option value={25} selected={pageSize === 25}>25</option>
                    <option value={50} selected={pageSize === 50}>50</option>
                    <option value={100} selected={pageSize === 100}>100</option>
                  </select>
                </label>
                <button type="submit" mix={submitButton}>Speichern</button>
              </div>
            </form>
          </div>

          <div mix={panelCss}>
            <h2 mix={sectionTitleCss}>Passwort ändern</h2>
            {passwordError ? <p role="alert" mix={errorBanner}>{passwordError}</p> : null}
            {passwordSuccess ? <p role="status" mix={successBanner}>{passwordSuccess}</p> : null}
            <form action={routes.settings.action.href()} method="POST">
              <CsrfTokenInput />
              <PasswordToggle />
              <div mix={formContainer}>
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
              </div>
            </form>
          </div>

          <div mix={panelCss}>
            <h2 mix={sectionTitleCss}>Konto löschen</h2>
            <p mix={warningTextCss}>Diese Aktion löscht Ihr Konto und alle zugehörigen Daten dauerhaft. Dies kann nicht rückgängig gemacht werden.</p>
            {deleteError ? <p role="alert" mix={errorBanner}>{deleteError}</p> : null}
            {deleteSuccess ? <p role="status" mix={successBanner}>{deleteSuccess}</p> : null}
            <form action={routes.settings.action.href()} method="POST">
              <input type="hidden" name="_action" value="delete-account" />
              <CsrfTokenInput />
              <div mix={[formContainer, deleteFormCss]}>
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
              </div>
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

const profileGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const profileFieldCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

const profileLabelCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const profileValueCss = css({
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
})

const formContainer = css({
  display: 'grid',
  gap: theme.space.md,
})

const deleteFormCss = css({
  '@media (max-width: 768px)': {
    gap: theme.space.sm,
  },
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

const selectCss = css({
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  fontSize: theme.fontSize.md,
  fontFamily: theme.fontFamily.sans,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  cursor: 'pointer',
})

const hintTextCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  margin: '0 0 1rem',
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
  '@media (max-width: 768px)': {
    padding: '0.35rem 1rem',
  },
})

const warningTextCss = css({
  color: theme.colors.action.danger.border,
  fontSize: theme.fontSize.xs,
  margin: '0 0 1rem',
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
