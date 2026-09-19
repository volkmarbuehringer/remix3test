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
import { formatUtcDateDE } from '../../utils/date-utils.ts'
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
              activeTab="settings-account"
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
              activeTab="settings-account"
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
              activeTab="settings-account"
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
              activeTab="settings-account"
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
        return redirect(`${routes.settings.index.href()}#settings-display`)
      }

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsPage
            user={user}
            pageSize={pageSize}
            activeTab="settings-password"
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
            activeTab="settings-password"
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
            activeTab="settings-password"
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
            activeTab="settings-password"
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
            activeTab="settings-password"
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
          activeTab="settings-password"
          passwordSuccess="Passwort erfolgreich aktualisiert. Andere Geräte wurden abgemeldet."
        />,
      )
    },
  },
})

/** Initials for the decorative profile avatar, e.g. "John Doe" -> "JD". */
function initialsFromName(name: string): string {
  let parts = name.trim().split(/\s+/).filter(Boolean)
  let first = parts[0]?.charAt(0) ?? ''
  let last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

function roleLabelDE(role: User['role']): string {
  return role === 'admin' ? 'Administrator' : 'Kunde'
}

// CSS-only no-JS fallback for the tab panels. Inactive panels are server-rendered
// with `hidden` so they stay out of the first paint. The `scripting` media
// feature is evaluated by the browser against the real scripting setting and is
// immune to the client runtime's DOM patching, so the reveal rule only ever
// applies when scripting is disabled — letting the tab anchors fall back to
// plain in-page links.
const PANEL_REVEAL_CSS =
  '@media (scripting: none) { [data-settings-tabpanel][hidden] { display: flex !important; } }'

// The settings panels are presented as ARIA tabs. The order here is the tab
// order, and each id doubles as the panel's DOM id and the URL fragment that
// deep-links it (e.g. /settings#settings-password).
const SETTINGS_TABS = [
  { id: 'settings-profile', label: 'Profil' },
  { id: 'settings-display', label: 'Anzeige' },
  { id: 'settings-password', label: 'Passwort' },
  { id: 'settings-account', label: 'Konto' },
] as const

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']
const DEFAULT_SETTINGS_TAB: SettingsTabId = 'settings-profile'

type SettingsPageProps = {
  user: User
  pageSize: number
  passwordError?: string
  passwordErrors?: Record<string, string | undefined>
  passwordSuccess?: string
  deleteError?: string
  /** Tab to mark selected on the server render; defaults to the profile tab. */
  activeTab?: SettingsTabId
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { user, pageSize, passwordError, passwordErrors, passwordSuccess, deleteError } =
      handle.props
    let activeTab = handle.props.activeTab ?? DEFAULT_SETTINGS_TAB
    // Inactive panels are hidden in the initial server HTML so the whole page
    // never flashes before the client entry applies tab visibility. The
    // @media (scripting: none) rule below reveals them again when JS is
    // unavailable.
    let panelHidden = (tabId: SettingsTabId) => (tabId === activeTab ? undefined : true)

    return (
      <Layout title="Einstellungen">
        <PageSection
          title="Einstellungen"
          titleHidden
          description="Verwalten Sie Ihre Kontoeinstellungen."
        >
          <SettingsEnhance />
          {/*
            Inactive panels are server-rendered with the `hidden` attribute so
            the full page cannot flash before SettingsEnhance runs. When JS is
            disabled the panels must all be visible again so the tab anchors keep
            working as plain in-page links.

            A <noscript> element cannot carry that rule: after the first
            client-side patch the Remix UI runtime re-parses the noscript body
            into a live <style>, which would un-hide every panel. A `data-js`
            flag on <html> is also unreliable — the runtime reconciles the
            document element against the server HTML and drops the flag. The
            `@media (scripting: none)` rule below is immune to both.
          */}
          <style>{PANEL_REVEAL_CSS}</style>
          <div mix={sectionTabListCss} role="tablist" aria-label="Bereiche der Einstellungen">
            {SETTINGS_TABS.map((tab) => (
              <a
                mix={sectionTabCss}
                href={`#${tab.id}`}
                id={`${tab.id}-tab`}
                role="tab"
                aria-controls={tab.id}
                aria-selected={tab.id === activeTab ? 'true' : 'false'}
                tabindex={tab.id === activeTab ? 0 : -1}
                data-settings-tab
              >
                {tab.label}
              </a>
            ))}
          </div>
          <div mix={settingsGridCss} data-settings-active-tab={activeTab}>
            <div
              mix={[panelCss, panelAnchorCss]}
              id="settings-profile"
              role="tabpanel"
              aria-labelledby="settings-profile-tab"
              tabindex={0}
              data-settings-tabpanel
              hidden={panelHidden('settings-profile')}
            >
              <h2 id="settings-profile-title" mix={sectionTitleCss}>
                Profil
              </h2>
              <div mix={profileHeaderCss}>
                <span mix={avatarCss} aria-hidden="true">
                  {initialsFromName(user.name)}
                </span>
                <div mix={profileIdentityCss}>
                  <span mix={profileNameCss}>{user.name}</span>
                  <span mix={profileEmailCss}>{user.email}</span>
                </div>
              </div>
              <dl mix={profileMetaCss}>
                <div mix={profileMetaRowCss}>
                  <dt mix={profileLabelCss}>Rolle</dt>
                  <dd mix={profileValueCss}>
                    <span
                      mix={[badgeCss, user.role === 'admin' ? badgeAdminCss : badgeNeutralCss]}
                      data-settings-role={user.role}
                    >
                      {roleLabelDE(user.role)}
                    </span>
                  </dd>
                </div>
                <div mix={profileMetaRowCss}>
                  <dt mix={profileLabelCss}>E-Mail-Status</dt>
                  <dd mix={profileValueCss}>
                    {user.email_verified === 1 ? (
                      <span mix={[badgeCss, badgeSuccessCss]}>Bestätigt</span>
                    ) : (
                      <span mix={[badgeCss, badgeWarningCss]}>Nicht bestätigt</span>
                    )}
                  </dd>
                </div>
                <div mix={profileMetaRowCss}>
                  <dt mix={profileLabelCss}>Mitglied seit</dt>
                  <dd mix={profileValueCss}>
                    <span data-settings-member-since>{formatUtcDateDE(user.created_at)}</span>
                  </dd>
                </div>
              </dl>
              <p mix={hintTextCss}>
                Um Name oder E-Mail zu ändern, kontaktieren Sie Ihren Administrator.
              </p>
            </div>

            <div
              mix={[panelCss, panelAnchorCss]}
              id="settings-display"
              role="tabpanel"
              aria-labelledby="settings-display-tab"
              tabindex={0}
              data-settings-tabpanel
              hidden={panelHidden('settings-display')}
            >
              <h2 id="settings-display-title" mix={sectionTitleCss}>
                Anzeige
              </h2>
              <p mix={hintTextCss}>Gilt für alle Listen während dieser Sitzung.</p>
              <form action={routes.settings.action.href()} method="POST">
                <input type="hidden" name="_action" value="set-page-size" />
                <CsrfTokenInput />
                <div mix={pageSizeRowCss}>
                  <label mix={[fieldLabelCss, pageSizeFieldCss]}>
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

            <div
              mix={[panelCss, fullSpanCss, panelAnchorCss]}
              id="settings-password"
              role="tabpanel"
              aria-labelledby="settings-password-tab"
              tabindex={0}
              data-settings-panel
              data-settings-tabpanel
              hidden={panelHidden('settings-password')}
            >
              <h2 id="settings-password-title" mix={sectionTitleCss}>
                Passwort ändern
              </h2>
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
              <form action={routes.settings.action.href()} method="POST" mix={formWidthCss}>
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

            <div
              mix={[panelCss, dangerZoneCss, fullSpanCss, panelAnchorCss]}
              id="settings-account"
              role="tabpanel"
              aria-labelledby="settings-account-tab"
              tabindex={0}
              data-settings-tabpanel
              hidden={panelHidden('settings-account')}
            >
              <h2 id="settings-account-title" mix={[sectionTitleCss, dangerTitleCss]}>
                Konto löschen
              </h2>
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
                mix={formWidthCss}
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
                      data-delete-confirm
                      mix={confirmCheckboxCss}
                    />
                    <span>Ich möchte mein Konto dauerhaft löschen</span>
                  </label>
                  <button type="submit" data-delete-submit mix={deleteButtonCss}>
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
  error?: string | undefined
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

// Tabs reveal exactly one panel at a time, so the panels stack full-width
// instead of the previous two-column grid.
const settingsGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.space.lg,
  alignItems: 'start',
})

// ARIA tab list for the four settings panels. Anchors (not buttons) keep the
// URL fragment meaningful and give a no-JavaScript fallback: the
// @media (scripting: none) rule above reveals every panel and each link scrolls
// to its own panel. With JS the inactive panels start hidden server-side so the
// full page never flashes before the client entry applies tab visibility.
const sectionTabListCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

const sectionTabCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '36px',
  padding: `0 ${theme.space.md}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
  '&:hover': {
    backgroundColor: theme.surface.lvl1,
    borderColor: theme.colors.border.default,
    color: theme.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: 2,
  },
  // Declared after :hover in the same descriptor so the selected tab stays
  // visually selected even while it is hovered.
  '&[aria-selected="true"]': {
    backgroundColor: theme.colors.action.primary.background,
    borderColor: theme.colors.action.primary.border,
    color: theme.colors.action.primary.foreground,
  },
})

// Keeps an anchored panel clear of the viewport edge when the fragment scrolls.
const panelAnchorCss = css({
  scrollMarginTop: theme.space.lg,
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

const profileHeaderCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
})

const avatarCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '48px',
  height: '48px',
  flexShrink: 0,
  borderRadius: theme.radius.full,
  border: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: theme.surface.lvl2,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
})

const profileIdentityCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
})

const profileNameCss = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const profileEmailCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  overflowWrap: 'anywhere',
})

const profileMetaCss = css({
  display: 'grid',
  gap: theme.space.sm,
  margin: 0,
})

const profileMetaRowCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

// Badges are self-contained variant styles: the base owns shape only and each
// variant owns its own colours, so no two descriptors contest the same
// property across Remix UI's per-class cascade layers.
const badgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  padding: `2px ${theme.space.sm}`,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

const badgeNeutralCss = css({
  backgroundColor: theme.surface.lvl1,
  borderColor: theme.colors.border.subtle,
  color: theme.colors.text.secondary,
})

const badgeAdminCss = css({
  backgroundColor: theme.colors.action.primary.background,
  borderColor: theme.colors.action.primary.border,
  color: theme.colors.action.primary.foreground,
})

const badgeSuccessCss = css({
  backgroundColor: theme.colors.success.background,
  borderColor: theme.colors.success.border,
  color: theme.colors.success.foreground,
})

const badgeWarningCss = css({
  backgroundColor: theme.colors.warning.background,
  borderColor: theme.colors.warning.border,
  color: theme.colors.warning.foreground,
})

const profileLabelCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const profileValueCss = css({
  margin: 0,
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

// Keep text inputs a comfortable reading width on wide desktop panels instead
// of stretching them across the full two-column grid.
const formWidthCss = css({
  maxWidth: '32rem',
})

const pageSizeRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: theme.space.md,
})

const pageSizeFieldCss = css({
  flex: '1 1 12rem',
  maxWidth: '16rem',
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
  justifySelf: 'start',
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
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
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
  justifySelf: 'start',
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
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
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
