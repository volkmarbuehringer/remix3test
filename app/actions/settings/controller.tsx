import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import { Glyph } from '../../ui/theme/glyph/glyph.tsx'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'

import { requireAuth } from '../../middleware/auth.ts'
import { users, type User } from '../../data/schema.ts'
import { hashPassword, verifyPassword } from '../../utils/password-hash.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { getPageSize, VALID_PAGE_SIZES } from '../../utils/get-page-size.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { deleteUser } from '../../data/settings.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageSection, panelCss } from '../../ui/page-primitives.tsx'
import {
  fieldLabelCss,
  fieldErrorCss,
  inputWrapperCss,
  inputHasToggleCss,
  toggleButtonCss,
} from '../../ui/auth-card.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import { validatePasswordComplexity, PASSWORD_MIN_LENGTH } from '../../utils/password-complexity.ts'
import { sendAccountDeletionEmail } from '../../utils/send-email.ts'
import { input } from '../../ui/mixins/input.ts'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { ConfirmDelete } from '../../ui/confirm-delete.browser.tsx'
import { SettingsEnhance } from '../../ui/settings-enhance.browser.tsx'

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
            <SettingsPage
              user={user}
              pageSize={pageSize}
              deleteError="Administratoren können ihr Konto nicht selbst löschen."
            />,
            { status: 403 },
          )
        }

        if (!deleteAccountLimiter.attempt(user.id)) {
          return context.render(
            <SettingsPage
              user={user}
              pageSize={pageSize}
              deleteError="Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut."
            />,
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
              user={user}
              pageSize={pageSize}
              deleteError="Aktuelles Passwort ist falsch."
            />,
            { status: 400 },
          )
        }

        await logAdminAction(context.db, {
          admin_user_id: user.id,
          admin_email: user.email,
          action_type: 'self-delete',
          target_type: 'users',
          target_id: user.id,
        })

        try {
          await deleteUser(context.db, user.id)
        } catch (err) {
          deleteAccountLimiter.reset(user.id)
          return context.render(
            <SettingsPage
              user={user}
              pageSize={pageSize}
              deleteError="Konto konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut."
            />,
            { status: 500 },
          )
        }

        let session = context.session
        if (session) {
          session.regenerateId(true)
        }

        if (process.env.NODE_ENV !== 'test') {
          try {
            await sendAccountDeletionEmail(
              context.mailer,
              { name: user.name, email: user.email },
              'self',
            )
          } catch (err) {
            context.logger?.('Failed to send account deletion email: ' + String(err))
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
            session.flash('success', 'Einträge pro Seite gespeichert.')
          }
        }
        return redirect(routes.settings.index.href())
      }

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            passwordError="Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut."
          />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(changePasswordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            passwordError="Bitte überprüfen Sie Ihre Eingabe."
            passwordErrors={issuesToFieldErrors(parsed.issues)}
          />,
          { status: 400 },
        )
      }

      let { currentPassword, newPassword, confirmPassword } = parsed.value

      let valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            passwordError="Aktuelles Passwort ist falsch."
            passwordErrors={{ currentPassword: 'Falsches Passwort' }}
          />,
          { status: 400 },
        )
      }

      if (newPassword !== confirmPassword) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            passwordError="Passwörter stimmen nicht überein."
            passwordErrors={{ confirmPassword: 'Passwörter stimmen nicht überein' }}
          />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(newPassword)
      if (complexityError) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            passwordError={complexityError}
            passwordErrors={{ newPassword: complexityError }}
          />,
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

      return context.render(
        <SettingsPage
          user={user}
          pageSize={pageSize}
          passwordSuccess="Passwort erfolgreich aktualisiert. Andere Geräte wurden abgemeldet."
        />,
      )
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
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { user, pageSize, passwordError, passwordErrors, passwordSuccess, deleteError } =
      handle.props

    return (
      <Layout title="Einstellungen">
        <PageSection title="Einstellungen" description="Verwalten Sie Ihre Kontoeinstellungen.">
          <SettingsEnhance />
          <div mix={settingsGridCss}>
            <div mix={panelCss}>
              <h2 mix={sectionTitleCss}>Profil</h2>
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
              <p mix={hintTextCss}>
                Um Name oder E-Mail zu ändern, kontaktieren Sie Ihren Administrator.
              </p>
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
                      <option value={10} selected={pageSize === 10}>
                        10
                      </option>
                      <option value={15} selected={pageSize === 15}>
                        15
                      </option>
                      <option value={20} selected={pageSize === 20}>
                        20
                      </option>
                      <option value={25} selected={pageSize === 25}>
                        25
                      </option>
                      <option value={50} selected={pageSize === 50}>
                        50
                      </option>
                      <option value={100} selected={pageSize === 100}>
                        100
                      </option>
                    </select>
                  </label>
                  <button type="submit" mix={submitButton} aria-label="Anzeige speichern">
                    Speichern
                  </button>
                </div>
              </form>
            </div>

            <div mix={[panelCss, fullSpanCss]} data-settings-panel>
              <h3 mix={sectionTitleCss}>Passwort ändern</h3>
              {passwordError ? (
                <p role="alert" data-settings-alert mix={errorBanner}>
                  {passwordError}
                </p>
              ) : null}
              {passwordSuccess ? (
                <p role="status" data-settings-status mix={successBanner}>
                  {passwordSuccess}
                </p>
              ) : null}
              <form action={routes.settings.action.href()} method="POST">
                <CsrfTokenInput />
                <div mix={formContainer}>
                  <PasswordField
                    label="Aktuelles Passwort"
                    name="currentPassword"
                    fieldId="current-password"
                    autoComplete="current-password"
                    error={passwordErrors?.currentPassword}
                    errorId="current-password-error"
                  />
                  <PasswordField
                    label="Neues Passwort"
                    name="newPassword"
                    fieldId="new-password"
                    autoComplete="new-password"
                    minLength
                    error={passwordErrors?.newPassword}
                    errorId="new-password-error"
                  >
                    <ul
                      id="password-rules"
                      mix={complexityListCss}
                      data-pw-complexity
                      aria-label="Passwort-Anforderungen"
                    >
                      <li data-complexity-rule="length">Mindestens 10 Zeichen</li>
                      <li data-complexity-rule="digit">Mindestens eine Zahl (0-9)</li>
                      <li data-complexity-rule="special">Mindestens ein Sonderzeichen</li>
                    </ul>
                  </PasswordField>
                  <PasswordField
                    label="Neues Passwort bestätigen"
                    name="confirmPassword"
                    fieldId="confirm-password"
                    autoComplete="new-password"
                    error={passwordErrors?.confirmPassword}
                    errorId="confirm-password-error"
                  >
                    <p data-pw-match role="status" aria-live="polite" mix={matchFeedbackCss}></p>
                  </PasswordField>

                  <button type="submit" mix={submitButton} aria-label="Passwort speichern">
                    Speichern
                  </button>
                </div>
              </form>
            </div>

            <div mix={[panelCss, dangerZoneCss, fullSpanCss]}>
              <h3 mix={[sectionTitleCss, dangerTitleCss]}>Konto löschen</h3>
              <p mix={warningTextCss}>
                Diese Aktion löscht Ihr Konto und alle zugehörigen Daten dauerhaft. Dies kann nicht
                rückgängig gemacht werden. Alle Sitzungen werden beendet.
              </p>
              {deleteError ? (
                <p role="alert" mix={errorBanner}>
                  {deleteError}
                </p>
              ) : null}
              <form
                action={routes.settings.action.href()}
                method="POST"
                data-confirm="Möchten Sie Ihr Konto wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden."
              >
                <input type="hidden" name="_action" value="delete-account" />
                <CsrfTokenInput />
                <div mix={[formContainer, deleteFormCss]}>
                  <label mix={fieldLabelCss}>
                    <span>Passwort eingeben zur Bestätigung</span>
                    <input
                      type="password"
                      name="currentPassword"
                      required
                      autoComplete="current-password"
                      mix={[input.base, input.focus]}
                    />
                  </label>
                  <label mix={confirmLabelCss}>
                    <input
                      type="checkbox"
                      name="confirmDelete"
                      required
                      defaultChecked={deleteError ? true : undefined}
                      mix={confirmCheckboxCss}
                    />
                    <span>Ich möchte mein Konto dauerhaft löschen</span>
                  </label>
                  <button type="submit" mix={deleteButtonCss}>
                    Konto dauerhaft löschen
                  </button>
                </div>
              </form>
            </div>
          </div>
          <ConfirmDelete />
        </PageSection>
      </Layout>
    )
  }
}

type PasswordFieldProps = {
  autoComplete: string
  error?: string
  errorId: string
  fieldId: string
  label: string
  minLength?: boolean
  name: string
  children?: RemixNode
}

function PasswordField(handle: Handle<PasswordFieldProps>) {
  return () => {
    let { autoComplete, error, errorId, fieldId, label, minLength, name, children } = handle.props

    return (
      <div mix={fieldGroupCss}>
        <label mix={fieldLabelCss} htmlFor={fieldId}>
          <span>{label}</span>
        </label>
        <div mix={inputWrapperCss}>
          <input
            id={fieldId}
            type="password"
            name={name}
            required
            autoComplete={autoComplete}
            minLength={minLength ? PASSWORD_MIN_LENGTH : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error
                ? minLength
                  ? `${errorId} password-rules`
                  : errorId
                : minLength
                  ? 'password-rules'
                  : undefined
            }
            mix={[input.base, input.focus, error ? input.error : undefined, inputHasToggleCss]}
          />
          <button
            type="button"
            data-toggle-pw={name}
            aria-label={`${label} anzeigen`}
            data-label-show={`${label} anzeigen`}
            data-label-hide={`${label} ausblenden`}
            mix={toggleButtonCss}
          >
            <Glyph name="eye" width={18} height={18} />
          </button>
        </div>
        {error ? (
          <span id={errorId} role="alert" mix={fieldErrorCss}>
            {error}
          </span>
        ) : null}
        {children}
      </div>
    )
  }
}

const sectionTitleCss = css({
  margin: '0 0 1rem',
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

// Two-column grid on desktop so the four settings panels fit without
// scrolling; collapses to a single column on small screens/narrow windows.
const settingsGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.space.lg,
  alignItems: 'start',
  '@media (min-width: 900px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
})

const dangerZoneCss = css({
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderLeft: `4px solid ${theme.colors.action.danger.border}`,
})

const dangerTitleCss = css({
  color: theme.colors.action.danger.background,
})

// Full-width panels (password change + danger zone) on the desktop two-column
// grid; the danger zone stays visually separated at the bottom instead of
// sitting next to a normal settings panel.
const fullSpanCss = css({
  gridColumn: '1 / -1',
})

const matchFeedbackCss = css({
  minHeight: '1.25rem',
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xs,
  '&[data-match="ok"]': {
    color: theme.colors.success.foreground,
  },
  '&[data-match="bad"]': {
    color: theme.colors.action.danger.background,
  },
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
  color: theme.colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const profileValueCss = css({
  fontSize: theme.fontSize.md,
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
})

const fieldGroupCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
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

const complexityListCss = css({
  listStyle: 'none',
  margin: `${theme.space.xs} 0 0`,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  '& li::before': {
    content: '"○ "',
    color: theme.colors.text.secondary,
  },
  '& li[data-ok="true"]::before': {
    content: '"✓ "',
    color: theme.colors.success.foreground,
  },
  '& li[data-ok="true"]': {
    color: theme.colors.text.secondary,
  },
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
  color: theme.colors.text.secondary,
  margin: '0 0 1rem',
})

const submitButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
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
  minHeight: '44px',
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

const confirmCheckboxCss = css({
  width: '24px',
  height: '24px',
  flexShrink: 0,
  accentColor: theme.colors.action.danger.background,
})
