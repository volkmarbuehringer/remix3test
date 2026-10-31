import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { panelEntrance } from '../../ui/mixins/panel-entrance.ts'
import { theme } from '../../ui/theme/theme.ts'
import { buttonLink } from '../../ui/theme/button.ts'
import { input } from '../../ui/mixins/input.ts'
import { table } from '../../ui/mixins/admin-table.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { PendingSubmitButton } from '../../ui/pending-submit.browser.tsx'
import { FormErrorFocus } from '../../ui/form-error-focus.browser.tsx'
import { gridStateToParams } from '../../utils/grid-state.ts'
import { formatIsoDateUtc } from '../../utils/date-utils.ts'
import { getSelfFrameTarget } from '../../utils/frame-target.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Styles (unique to this panel)
// ---------------------------------------------------------------------------

const requiredStarStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.bold,
})

const fieldHintStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const selectStyle = css({
  cursor: 'pointer',
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientCreatePageProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
  status?: string
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function ClientCreatePage(handle: Handle<ClientCreatePageProps>) {
  return () => {
    let {
      offset = '',
      sort = '',
      order = '',
      filter = '',
      status = '',
      formValues,
      fieldErrors,
    } = handle.props
    let selectedRole =
      formValues?.role === 'Admin' || formValues?.role === 'Editor' || formValues?.role === 'Viewer'
        ? formValues.role
        : 'Viewer'
    let selectedStatus =
      formValues?.status === 'Active' || formValues?.status === 'Inactive'
        ? formValues.status
        : 'Active'
    return (
      <div mix={panelEntrance}>
        <RestfulForm
          method="POST"
          action={routes.admin.clients.index.href()}
          data-rmx-target={getSelfFrameTarget()}
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Kunde</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-name">
                  Name{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="cf-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? ''}
                  placeholder="Vollständigen Namen eingeben"
                  required
                  minLength={8}
                  maxLength={100}
                  aria-invalid={fieldErrors?.name ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.name ? 'cf-name-hint cf-name-error' : 'cf-name-hint'
                  }
                />
                <div id="cf-name-hint" mix={fieldHintStyle}>
                  Mindestens 8 Zeichen.
                </div>
                {fieldErrors?.name ? (
                  <div id="cf-name-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.name}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-email">
                  E-Mail{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="cf-email"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? ''}
                  placeholder="user@example.com"
                  required
                  maxLength={100}
                  aria-invalid={fieldErrors?.email ? 'true' : undefined}
                  aria-describedby={fieldErrors?.email ? 'cf-email-error' : undefined}
                />
                {fieldErrors?.email ? (
                  <div id="cf-email-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.email}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-role">
                  Rolle
                </label>
                <select
                  id="cf-role"
                  name="role"
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    fieldErrors?.role ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  aria-invalid={fieldErrors?.role ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.role ? 'cf-role-hint cf-role-error' : 'cf-role-hint'
                  }
                >
                  <option value="Viewer" selected={selectedRole === 'Viewer'}>
                    Viewer
                  </option>
                  <option value="Editor" selected={selectedRole === 'Editor'}>
                    Editor
                  </option>
                  <option value="Admin" selected={selectedRole === 'Admin'}>
                    Admin
                  </option>
                </select>
                <div id="cf-role-hint" mix={fieldHintStyle}>
                  Berechtigungsstufe
                </div>
                {fieldErrors?.role ? (
                  <div id="cf-role-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.role}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-status">
                  Status
                </label>
                <select
                  id="cf-status"
                  name="status"
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    fieldErrors?.status ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  aria-invalid={fieldErrors?.status ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.status ? 'cf-status-hint cf-status-error' : 'cf-status-hint'
                  }
                >
                  <option value="Active" selected={selectedStatus === 'Active'}>
                    Active
                  </option>
                  <option value="Inactive" selected={selectedStatus === 'Inactive'}>
                    Inactive
                  </option>
                </select>
                <div id="cf-status-hint" mix={fieldHintStyle}>
                  Aktivierungsstatus
                </div>
                {fieldErrors?.status ? (
                  <div id="cf-status-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.status}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-registered">
                  Registriert{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="cf-registered"
                  name="registered"
                  type="date"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.registered ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.registered ?? formatIsoDateUtc()}
                  required
                  aria-invalid={fieldErrors?.registered ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.registered
                      ? 'cf-registered-hint cf-registered-error'
                      : 'cf-registered-hint'
                  }
                />
                <div id="cf-registered-hint" mix={fieldHintStyle}>
                  Datum aus 2026.
                </div>
                {fieldErrors?.registered ? (
                  <div id="cf-registered-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.registered}
                  </div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <PendingSubmitButton>Anlegen</PendingSubmitButton>
                {(() => {
                  let cancelQ = gridStateToParams({
                    offset,
                    sort,
                    order,
                    filter,
                    status,
                  }).toString()
                  let cancelHref =
                    routes.admin.clients.index.href() + (cancelQ ? '?' + cancelQ : '')
                  return (
                    <a
                      href={cancelHref}
                      mix={[
                        buttonLink({ tone: 'secondary' }),
                        table.spacer,
                        css({ width: '100%' }),
                      ]}
                    >
                      Abbrechen
                    </a>
                  )
                })()}
              </div>
            </div>
          </div>
          <FormErrorFocus />
        </RestfulForm>
      </div>
    )
  }
}

export { ClientCreatePage }
