import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import button from '../../ui/theme/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../../utils/motion.ts'
import { input } from '../../ui/mixins/input.ts'
import { table } from '../../ui/mixins/admin-table.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { buildCancelUrl } from '../../ui/mixins/admin-urls.ts'
import { frames } from '../../routes.ts'

import type { Client } from '../../data/schema.ts'

type Row = Client

interface ClientEditPageProps {
  row: Row
  offset: string
  sort: string
  order: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
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
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ClientEditPage(handle: Handle<ClientEditPageProps>) {
  return () => {
    let { row, offset, sort, order, filter = '', formValues, fieldErrors } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm method="PUT" action={`/admin/client/${row.id}`} rmx-target={frames.adminContent}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.id}</span>
              <span mix={table.panelTitle}>Edit Record</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-name">
                  Name <span mix={requiredStarStyle}>*</span>
                </label>
                <input
                  id="ef-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? row.name}
                  placeholder="Enter full name"
                  required
                  maxLength={100}
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-email">
                  Email <span mix={requiredStarStyle}>*</span>
                </label>
                <input
                  id="ef-email"
                  name="email"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? row.email}
                  placeholder="user@example.com"
                  required
                  maxLength={100}
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-role">
                  Role
                </label>
                <select id="ef-role" name="role" mix={[input.base, input.focus, selectStyle]}>
                  <option
                    value="Admin"
                    selected={
                      formValues?.role !== undefined
                        ? formValues.role === 'Admin'
                        : row.role === 'Admin'
                    }
                  >
                    Admin
                  </option>
                  <option
                    value="Editor"
                    selected={
                      formValues?.role !== undefined
                        ? formValues.role === 'Editor'
                        : row.role === 'Editor'
                    }
                  >
                    Editor
                  </option>
                  <option
                    value="Viewer"
                    selected={
                      formValues?.role !== undefined
                        ? formValues.role === 'Viewer'
                        : row.role === 'Viewer'
                    }
                  >
                    Viewer
                  </option>
                </select>
                <div mix={fieldHintStyle}>User permission level</div>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-status">
                  Status
                </label>
                <select id="ef-status" name="status" mix={[input.base, input.focus, selectStyle]}>
                  <option
                    value="Active"
                    selected={
                      formValues?.status !== undefined
                        ? formValues.status === 'Active'
                        : row.status === 'Active'
                    }
                  >
                    Active
                  </option>
                  <option
                    value="Inactive"
                    selected={
                      formValues?.status !== undefined
                        ? formValues.status === 'Inactive'
                        : row.status === 'Inactive'
                    }
                  >
                    Inactive
                  </option>
                </select>
                <div mix={fieldHintStyle}>Account activation state</div>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ef-registered">
                  Registered <span mix={requiredStarStyle}>*</span>
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
                  value={formValues?.registered ?? formatDate(row.registered as number)}
                  required
                />
                {fieldErrors?.registered ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.registered}</div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Save Changes
                </button>
                <a
                  href={buildCancelUrl('/admin/client', offset, sort, order, filter)}
                  mix={[table.spacer, table.linkPlain]}
                >
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Cancel
                  </button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}

export { ClientEditPage }
