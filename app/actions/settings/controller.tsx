import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import type { Handle, RemixNode } from 'remix/component'
import { css, Frame } from 'remix/component'
import { theme } from '../../ui/theme/theme.ts'
import { Glyph } from '../../ui/theme/glyph/glyph.tsx'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { frames, routes } from '../../routes.ts'

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
import { PasswordToggle } from '../../ui/password-toggle.browser.tsx'
import { buttonLink } from '../../ui/theme/button.ts'
import { segmentedButton } from '../../ui/mixins/segmented.ts'

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
      let isFrame = context.request.headers.get('X-Remix-Target') === frames.settingsPanel
      return context.render(
        <SettingsView
          isFrame={isFrame}
          user={user}
          pageSize={pageSize}
          activeTab={resolveSettingsTab(context.url)}
        />,
      )
    },

    async action(context) {
      let user = getCurrentUser()
      let pageSize = getPageSize(context.session, 15)
      let isFrame = context.request.headers.get('X-Remix-Target') === frames.settingsPanel
      let _action =
        typeof context.formData.get('_action') === 'string'
          ? (context.formData.get('_action') as string)
          : undefined

      if (_action === 'delete-account') {
        if (user.role === 'admin') {
          return context.render(
            <SettingsView
              isFrame={isFrame}
              inline
              user={user}
              pageSize={pageSize}
              activeTab="account"
              deleteError="Administratoren können ihr Konto nicht selbst löschen."
            />,
            { status: 403 },
          )
        }

        if (!deleteAccountLimiter.attempt(user.id)) {
          return context.render(
            <SettingsView
              isFrame={isFrame}
              inline
              user={user}
              pageSize={pageSize}
              activeTab="account"
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
            <SettingsView
              isFrame={isFrame}
              inline
              user={user}
              pageSize={pageSize}
              activeTab="account"
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
            <SettingsView
              isFrame={isFrame}
              inline
              user={user}
              pageSize={pageSize}
              activeTab="account"
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
        return redirect(`${routes.settings.index.href()}?tab=display`)
      }

      if (!changePasswordLimiter.attempt(user.id)) {
        return context.render(
          <SettingsView
            isFrame={isFrame}
            inline
            user={user}
            pageSize={pageSize}
            activeTab="password"
            passwordError="Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut."
          />,
          { status: 429 },
        )
      }

      let parsed = s.parseSafe(changePasswordSchema, context.formData)
      if (!parsed.success) {
        return context.render(
          <SettingsView
            isFrame={isFrame}
            inline
            user={user}
            pageSize={pageSize}
            activeTab="password"
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
          <SettingsView
            isFrame={isFrame}
            inline
            user={user}
            pageSize={pageSize}
            activeTab="password"
            passwordError="Aktuelles Passwort ist falsch."
            passwordErrors={{ currentPassword: 'Falsches Passwort' }}
          />,
          { status: 400 },
        )
      }

      if (newPassword !== confirmPassword) {
        return context.render(
          <SettingsView
            isFrame={isFrame}
            inline
            user={user}
            pageSize={pageSize}
            activeTab="password"
            passwordError="Passwörter stimmen nicht überein."
            passwordErrors={{ confirmPassword: 'Passwörter stimmen nicht überein' }}
          />,
          { status: 400 },
        )
      }

      let complexityError = validatePasswordComplexity(newPassword)
      if (complexityError) {
        return context.render(
          <SettingsView
            isFrame={isFrame}
            inline
            user={user}
            pageSize={pageSize}
            activeTab="password"
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
        <SettingsView
          isFrame={isFrame}
          inline
          user={user}
          pageSize={pageSize}
          activeTab="password"
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

// The settings sections are server-rendered one at a time inside the
// `settings-panel` frame. `id` is both the `?tab=` value and the panel's DOM
// id; the order is the tab order. Deep links are real URLs
// (e.g. /settings?tab=password) because a hash-only change does not reload a frame.
const SETTINGS_TABS = [
  { id: 'profile', label: 'Profil' },
  { id: 'display', label: 'Anzeige' },
  { id: 'password', label: 'Passwort' },
  { id: 'account', label: 'Konto' },
] as const

type SettingsTab = (typeof SETTINGS_TABS)[number]['id']
const DEFAULT_SETTINGS_TAB: SettingsTab = 'profile'

function resolveSettingsTab(url: URL): SettingsTab {
  let raw = url.searchParams.get('tab')
  return SETTINGS_TABS.some((tab) => tab.id === raw) ? (raw as SettingsTab) : DEFAULT_SETTINGS_TAB
}

type SettingsPageProps = {
  user: User
  pageSize: number
  passwordError?: string
  passwordErrors?: Record<string, string | undefined>
  passwordSuccess?: string
  deleteError?: string
  /** Section rendered into the frame; defaults to the profile tab. */
  activeTab?: SettingsTab
}

type SettingsViewProps = SettingsPageProps & { isFrame: boolean; inline?: boolean }

function SettingsView(handle: Handle<SettingsViewProps>) {
  return () => {
    let { isFrame, inline, ...props } = handle.props
    if (isFrame) return <SettingsTabs {...props} />
    if (inline) {
      // A full-document POST response cannot rely on the frame: the frame's
      // content comes from a separate GET that never sees this action's
      // validation state. Render the section inline so errors survive no-JS
      // and non-frame submissions.
      return (
        <Layout title="Einstellungen">
          <PageSection
            title="Einstellungen"
            titleHidden
            description="Verwalten Sie Ihre Kontoeinstellungen."
          >
            <SettingsTabs {...props} />
            <PasswordToggle />
            <ConfirmDelete />
          </PageSection>
        </Layout>
      )
    }
    return <SettingsPage {...props} />
  }
}

function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let activeTab = handle.props.activeTab ?? DEFAULT_SETTINGS_TAB
    return (
      <Layout title="Einstellungen">
        <PageSection
          title="Einstellungen"
          titleHidden
          description="Verwalten Sie Ihre Kontoeinstellungen."
        >
          <Frame
            name={frames.settingsPanel}
            src={`${routes.settings.index.href()}?tab=${activeTab}`}
          />
          <PasswordToggle />
          <ConfirmDelete />
        </PageSection>
      </Layout>
    )
  }
}

function SettingsTabs(handle: Handle<SettingsPageProps>) {
  return () => {
    let { user, pageSize, passwordError, passwordErrors, passwordSuccess, deleteError } =
      handle.props
    let activeTab = handle.props.activeTab ?? DEFAULT_SETTINGS_TAB

    return (
      <>
        <nav mix={sectionTabListCss} aria-label="Bereiche der Einstellungen">
          {SETTINGS_TABS.map((tab, index) => {
            let isFirst = index === 0
            let isLast = index === SETTINGS_TABS.length - 1
            let active = tab.id === activeTab
            return (
              <a
                mix={[
                  buttonLink({ tone: active ? 'primary' : 'secondary' }),
                  segmentedButton({ isFirst, isLast }),
                ]}
                href={`${routes.settings.index.href()}?tab=${tab.id}`}
                aria-current={active ? 'page' : undefined}
                data-rmx-target={frames.settingsPanel}
                id={`settings-${tab.id}-tab`}
              >
                {tab.label}
              </a>
            )
          })}
        </nav>
        <div mix={settingsGridCss}>
          {activeTab === 'profile' ? (
            <div mix={[panelCss, panelAnchorCss]} id="settings-profile">
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
          ) : null}
          {activeTab === 'display' ? (
            <div mix={[panelCss, panelAnchorCss]} id="settings-display">
              <h2 id="settings-display-title" mix={sectionTitleCss}>
                Anzeige
              </h2>
              <p mix={hintTextCss}>Gilt für alle Listen während dieser Sitzung.</p>
              <form
                action={routes.settings.action.href()}
                method="POST"
                data-rmx-target={frames.settingsPanel}
              >
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
          ) : null}
          {activeTab === 'password' ? (
            <div mix={[panelCss, fullSpanCss, panelAnchorCss]} id="settings-password">
              <h2 id="settings-password-title" mix={sectionTitleCss}>
                Passwort ändern
              </h2>
              {passwordError ? (
                <p role="alert" mix={errorBanner}>
                  {passwordError}
                </p>
              ) : null}
              {passwordSuccess ? (
                <p role="status" mix={successBanner}>
                  {passwordSuccess}
                </p>
              ) : null}
              <form
                action={routes.settings.action.href()}
                method="POST"
                data-rmx-target={frames.settingsPanel}
                mix={formWidthCss}
              >
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
                      aria-label="Passwort-Anforderungen"
                    >
                      <li>Mindestens 10 Zeichen</li>
                      <li>Mindestens eine Zahl (0-9)</li>
                      <li>Mindestens ein Sonderzeichen</li>
                    </ul>
                  </PasswordField>
                  <PasswordField
                    label="Neues Passwort bestätigen"
                    name="confirmPassword"
                    fieldId="confirm-password"
                    autoComplete="new-password"
                    error={passwordErrors?.confirmPassword}
                    errorId="confirm-password-error"
                  />

                  <button type="submit" mix={submitButton} aria-label="Passwort speichern">
                    Speichern
                  </button>
                </div>
              </form>
            </div>
          ) : null}
          {activeTab === 'account' ? (
            <div mix={[panelCss, dangerZoneCss, fullSpanCss, panelAnchorCss]} id="settings-account">
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
                data-rmx-target={frames.settingsPanel}
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
          ) : null}
        </div>
      </>
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

// Settings section navigation, styled as a joined button group. Each item is a
// real link (?tab=…) that reloads the settings-panel frame through
// data-rmx-target; without the frame runtime they are ordinary same-origin
// navigations, so no client entry is involved.
const sectionTabListCss = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  flexWrap: 'wrap',
  maxWidth: '100%',
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
    content: '"• "',
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
