import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from '../../ui/mixins/input.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { buildCancelUrl } from '../../ui/mixins/admin-urls.ts'

import type { Client } from '../../data/schema.ts'

type Row = Client

interface ClientEditPageProps {
  row: Row
  offset: string
  sort: string
  order: string
  filter?: string
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})

const panelHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl2,
})

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

const panelTitleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const panelBodyStyle = css({
  padding: theme.space.lg,
})

const fieldGroupStyle = css({
  marginBottom: theme.space.md,
})

const labelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  marginBottom: theme.space.xs,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
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

const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
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
    let { row, offset, sort, order, filter = '' } = handle.props
    return (
    <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
      <RestfulForm method="PUT" action={`/client/${row.id}`}>
        <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

        <div mix={panelStyle}>
          <div mix={panelHeaderStyle}>
            <span mix={rowIdBadgeStyle}>#{row.id}</span>
            <span mix={panelTitleStyle}>Edit Record</span>
          </div>

          <div mix={panelBodyStyle}>
            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="ef-name">
                Name <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="ef-name"
                name="name"
                type="text"
                mix={[input.base, input.focus]}
                value={row.name}
                placeholder="Enter full name"
                required
                maxLength={100}
              />
            </div>

            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="ef-email">
                Email <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="ef-email"
                name="email"
                type="email"
                mix={[input.base, input.focus]}
                value={row.email}
                placeholder="user@example.com"
                required
                maxLength={100}
              />
            </div>

            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="ef-role">
                Role
              </label>
              <select id="ef-role" name="role" mix={[input.base, input.focus, selectStyle]}>
                <option value="Admin" selected={row.role === 'Admin'}>Admin</option>
                <option value="Editor" selected={row.role === 'Editor'}>Editor</option>
                <option value="Viewer" selected={row.role === 'Viewer'}>Viewer</option>
              </select>
              <div mix={fieldHintStyle}>User permission level</div>
            </div>

            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="ef-status">
                Status
              </label>
              <select id="ef-status" name="status" mix={[input.base, input.focus, selectStyle]}>
                <option value="Active" selected={row.status === 'Active'}>Active</option>
                <option value="Inactive" selected={row.status === 'Inactive'}>Inactive</option>
              </select>
              <div mix={fieldHintStyle}>Account activation state</div>
            </div>

            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="ef-registered">
                Registered <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="ef-registered"
                name="registered"
                type="date"
                mix={[input.base, input.focus]}
                value={formatDate(row.registered as number)}
                required
              />
            </div>

            <div mix={actionsStyle}>
              <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                Save Changes
              </Button>
              <a href={buildCancelUrl('/client', offset, sort, order, filter)} style={{ flex: 1, textDecoration: 'none' }}>
                <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                  Cancel
                </Button>
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
