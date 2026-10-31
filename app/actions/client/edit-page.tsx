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
import { buildCancelUrl } from '../../ui/mixins/admin-urls.ts'
import { formatIsoDateUtc } from '../../utils/date-utils.ts'
import { getSelfFrameTarget } from '../../utils/frame-target.ts'
import { routes } from '../../routes.ts'

import type { Client } from '../../data/schema.ts'

type Row = Client

interface ClientEditPageProps {
  row: Row
  offset: string
  sort: string
  order: string
  filter?: string
  status?: string
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

// ---------------------------------------------------------------------------
// Styles (unique to this panel)
// ---------------------------------------------------------------------------

const rowIdBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  background: theme.surface.lvl3,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
})

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

function ClientEditPage(handle: Handle<ClientEditPageProps>) {
  return () => {
    let {
      row,
      offset,
      sort,
      order,
      filter = '',
      status = '',
      formValues,
      fieldErrors,
    } = handle.props
    let rowRole =
      row.role === 'Admin' || row.role === 'Editor' || row.role === 'Viewer' ? row.role : 'Viewer'
    let rowStatus = row.status === 'Active' || row.status === 'Inactive' ? row.status : 'Active'
    let selectedRole =
      formValues?.role === 'Admin' || formValues?.role === 'Editor' || formValues?.role === 'Viewer'
        ? formValues.role
        : rowRole
    let selectedStatus =
      formValues?.status === 'Active' || formValues?.status === 'Inactive'
        ? formValues.status
        : rowStatus

    // Keep the action URL (the frame's committed src) in sync with the grid so
    // a reload of the resolver renders the same page, sort, and filter.
    let actionParams = new URLSearchParams()
    if (offset && offset !== '0') actionParams.set('offset', offset)
    if (sort) actionParams.set('sort', sort)
    if (order) actionParams.set('order', order)
    if (filter) actionParams.set('filter', filter)
    if (status) actionParams.set('status', status)
    let actionQuery = actionParams.toString()
    let actionSuffix = actionQuery ? '?' + actionQuery : ''

    return (
      <div mix={panelEntrance}>
        <RestfulForm
          method="PUT"
          action={routes.admin.clients.update.href({ id: row.id }) + actionSuffix}
          data-rmx-target={getSelfFrameTarget()}
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.id}</span>
              <span mix={table.panelTitle}>Kunde bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-name">
                  Name{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="ef-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? row.name}
                  placeholder="Vollständigen Namen eingeben"
                  required
                  minLength={8}
                  maxLength={100}
                  aria-invalid={fieldErrors?.name ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.name ? 'ef-name-hint ef-name-error' : 'ef-name-hint'
                  }
                />
                <div id="ef-name-hint" mix={fieldHintStyle}>
                  Mindestens 8 Zeichen.
                </div>
                {fieldErrors?.name ? (
                  <div id="ef-name-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.name}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-email">
                  E-Mail{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="ef-email"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? row.email}
                  placeholder="user@example.com"
                  required
                  maxLength={100}
                  aria-invalid={fieldErrors?.email ? 'true' : undefined}
                  aria-describedby={fieldErrors?.email ? 'ef-email-error' : undefined}
                />
                {fieldErrors?.email ? (
                  <div id="ef-email-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.email}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-role">
                  Rolle
                </label>
                <select
                  id="ef-role"
                  name="role"
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    fieldErrors?.role ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  aria-invalid={fieldErrors?.role ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.role ? 'ef-role-hint ef-role-error' : 'ef-role-hint'
                  }
                >
                  <option value="Admin" selected={selectedRole === 'Admin'}>
                    Admin
                  </option>
                  <option value="Editor" selected={selectedRole === 'Editor'}>
                    Editor
                  </option>
                  <option value="Viewer" selected={selectedRole === 'Viewer'}>
                    Viewer
                  </option>
                </select>
                <div id="ef-role-hint" mix={fieldHintStyle}>
                  Berechtigungsstufe
                </div>
                {fieldErrors?.role ? (
                  <div id="ef-role-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.role}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-status">
                  Status
                </label>
                <select
                  id="ef-status"
                  name="status"
                  mix={[
                    input.base,
                    input.focus,
                    selectStyle,
                    fieldErrors?.status ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  aria-invalid={fieldErrors?.status ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.status ? 'ef-status-hint ef-status-error' : 'ef-status-hint'
                  }
                >
                  <option value="Active" selected={selectedStatus === 'Active'}>
                    Active
                  </option>
                  <option value="Inactive" selected={selectedStatus === 'Inactive'}>
                    Inactive
                  </option>
                </select>
                <div id="ef-status-hint" mix={fieldHintStyle}>
                  Aktivierungsstatus
                </div>
                {fieldErrors?.status ? (
                  <div id="ef-status-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.status}
                  </div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-registered">
                  Registriert{' '}
                  <span aria-hidden="true" mix={requiredStarStyle}>
                    *
                  </span>
                </label>
                <input
                  id="ef-registered"
                  name="registered"
                  type="date"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.registered ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.registered ?? formatIsoDateUtc(row.registered as number)}
                  required
                  aria-invalid={fieldErrors?.registered ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors?.registered
                      ? 'ef-registered-hint ef-registered-error'
                      : 'ef-registered-hint'
                  }
                />
                <div id="ef-registered-hint" mix={fieldHintStyle}>
                  Datum aus 2026.
                </div>
                {fieldErrors?.registered ? (
                  <div id="ef-registered-error" role="alert" mix={fieldErrorStyle}>
                    {fieldErrors.registered}
                  </div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <PendingSubmitButton>Speichern</PendingSubmitButton>
                <a
                  href={buildCancelUrl(
                    routes.admin.clients.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                    undefined,
                    status,
                  )}
                  mix={[buttonLink({ tone: 'secondary' }), table.spacer, css({ width: '100%' })]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
          <FormErrorFocus />
        </RestfulForm>
      </div>
    )
  }
}

export { ClientEditPage }
