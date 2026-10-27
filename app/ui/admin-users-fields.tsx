import type { Handle, RemixNode } from 'remix/component'
import { css } from 'remix/component'

import { theme } from './theme/theme.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { PasswordReveal } from './password-reveal.browser.tsx'
import { PasswordComplexityChecklist } from './password-complexity.browser.tsx'
import { PASSWORD_MIN_LENGTH } from '../utils/password-complexity.ts'

interface UserAccountFieldsProps {
  /** Prefix for the field ids, e.g. `au` (edit) or `au-c` (create). */
  idPrefix: string
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  defaultName: string
  defaultEmail: string
  defaultRole: string
  /** Optional helper under the email field (the create panel explains the login). */
  emailHint?: string | undefined
  /** Optional block rendered between the role select and the password field. */
  statusSlot?: RemixNode
  passwordRequired?: boolean
  passwordPlaceholder?: string | undefined
  passwordHint: string
}

/**
 * The account fields shared by the users edit and create panels.
 *
 * Keeping one field set means a new field or an accessibility fix cannot land
 * in one panel and drift from the other. The panels own only their header,
 * identity/meta block, deactivated switch and actions.
 */
export function UserAccountFields(handle: Handle<UserAccountFieldsProps>) {
  return () => {
    let {
      idPrefix,
      formValues,
      fieldErrors,
      defaultName,
      defaultEmail,
      defaultRole,
      emailHint,
      statusSlot,
      passwordRequired = false,
      passwordPlaceholder,
      passwordHint,
    } = handle.props

    let nameId = `${idPrefix}-name`
    let emailId = `${idPrefix}-email`
    let roleId = `${idPrefix}-role`
    let passwordId = `${idPrefix}-password`
    let nameErrorId = `${nameId}-error`
    let emailErrorId = `${emailId}-error`
    let roleErrorId = `${roleId}-error`
    let passwordErrorId = `${passwordId}-error`
    let emailHintId = `${emailId}-hint`
    let roleHintId = `${roleId}-hint`
    let passwordHintId = `${passwordId}-hint`

    let emailDescribedBy = [
      emailHint ? emailHintId : undefined,
      fieldErrors?.email ? emailErrorId : undefined,
    ]
      .filter(Boolean)
      .join(' ')
    let roleDescribedBy = [roleHintId, fieldErrors?.role ? roleErrorId : undefined]
      .filter(Boolean)
      .join(' ')
    let passwordDescribedBy = [passwordHintId, fieldErrors?.password ? passwordErrorId : undefined]
      .filter(Boolean)
      .join(' ')

    return (
      <>
        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            autoComplete="name"
            mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
              Boolean,
            )}
            value={formValues?.name ?? defaultName}
            required
            aria-invalid={fieldErrors?.name ? true : undefined}
            aria-describedby={fieldErrors?.name ? nameErrorId : undefined}
          />
          {fieldErrors?.name ? (
            <div id={nameErrorId} role="alert" mix={fieldErrorStyle}>
              {fieldErrors.name}
            </div>
          ) : null}
        </div>

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={emailId}>
            E-Mail
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            mix={[input.base, input.focus, fieldErrors?.email ? inputErrorStyle : null].filter(
              Boolean,
            )}
            value={formValues?.email ?? defaultEmail}
            required
            aria-invalid={fieldErrors?.email ? true : undefined}
            aria-describedby={emailDescribedBy || undefined}
          />
          {emailHint ? (
            <div id={emailHintId} mix={fieldHintStyle}>
              {emailHint}
            </div>
          ) : null}
          {fieldErrors?.email ? (
            <div id={emailErrorId} role="alert" mix={fieldErrorStyle}>
              {fieldErrors.email}
            </div>
          ) : null}
        </div>

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={roleId}>
            Rolle
          </label>
          <select
            id={roleId}
            name="role"
            mix={[input.base, input.focus, table.select]}
            aria-invalid={fieldErrors?.role ? true : undefined}
            aria-describedby={roleDescribedBy}
          >
            <option value="customer" selected={(formValues?.role ?? defaultRole) === 'customer'}>
              Kunde
            </option>
            <option value="admin" selected={(formValues?.role ?? defaultRole) === 'admin'}>
              Admin
            </option>
          </select>
          <div id={roleHintId} mix={fieldHintStyle}>
            Admins erhalten Zugriff auf Verwaltung und Administration.
          </div>
          {fieldErrors?.role ? (
            <div id={roleErrorId} role="alert" mix={fieldErrorStyle}>
              {fieldErrors.role}
            </div>
          ) : null}
        </div>

        {statusSlot}

        <div mix={table.fieldGroup}>
          <label mix={table.label} htmlFor={passwordId}>
            {passwordRequired ? 'Passwort' : 'Neues Passwort'}
          </label>
          <div mix={passwordWrapStyle}>
            <input
              id={passwordId}
              name="password"
              type="password"
              required={passwordRequired}
              minLength={PASSWORD_MIN_LENGTH}
              placeholder={passwordPlaceholder}
              autoComplete="new-password"
              mix={[
                input.base,
                input.focus,
                passwordInputStyle,
                fieldErrors?.password ? inputErrorStyle : null,
              ].filter(Boolean)}
              aria-invalid={fieldErrors?.password ? true : undefined}
              aria-describedby={passwordDescribedBy}
            />
            <PasswordReveal fieldName="password" />
          </div>
          <div id={passwordHintId} mix={fieldHintStyle}>
            {passwordHint}
          </div>
          {fieldErrors?.password ? (
            <div id={passwordErrorId} role="alert" mix={fieldErrorStyle}>
              {fieldErrors.password}
            </div>
          ) : null}
          <PasswordComplexityChecklist fieldName="password" />
        </div>
      </>
    )
  }
}

export const fieldHintStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const inputErrorStyle = css({
  borderColor: theme.colors.action.danger.background,
  '&:focus': {
    borderColor: theme.colors.action.danger.background,
  },
})

const fieldErrorStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.action.danger.background,
})

const passwordWrapStyle = css({
  position: 'relative',
})

const passwordInputStyle = css({
  paddingRight: '2.4rem',
})
