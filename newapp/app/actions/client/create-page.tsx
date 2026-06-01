import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from '../../ui/mixins/input.ts'
import { table } from '../../ui/mixins/admin-table.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { gridStateToParams } from '../../utils/grid-state.ts'

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientCreatePageProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

function ClientCreatePage(handle: Handle<ClientCreatePageProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
    <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
      <RestfulForm method="POST" action="/client">
        <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

        <div mix={table.panel}>
          <div mix={table.panelHeader}>
            <span mix={table.panelTitle}>New Record</span>
          </div>

          <div mix={table.panelBody}>
            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="cf-name">
                Name <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="cf-name"
                name="name"
                type="text"
                mix={[input.base, input.focus]}
                placeholder="Enter full name"
                required
                maxLength={100}
              />
            </div>

            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="cf-email">
                Email <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="cf-email"
                name="email"
                type="email"
                mix={[input.base, input.focus]}
                placeholder="user@example.com"
                required
                maxLength={100}
              />
            </div>

            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="cf-role">
                Role
              </label>
              <select id="cf-role" name="role" mix={[input.base, input.focus, selectStyle]}>
                <option value="Viewer" selected>Viewer</option>
                <option value="Editor">Editor</option>
                <option value="Admin">Admin</option>
              </select>
              <div mix={fieldHintStyle}>User permission level</div>
            </div>

            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="cf-status">
                Status
              </label>
              <select id="cf-status" name="status" mix={[input.base, input.focus, selectStyle]}>
                <option value="Active" selected>Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div mix={fieldHintStyle}>Account activation state</div>
            </div>

            <div mix={table.fieldGroup}>
              <label mix={table.label} htmlFor="cf-registered">
                Registered <span mix={requiredStarStyle}>*</span>
              </label>
              <input
                id="cf-registered"
                name="registered"
                type="date"
                mix={[input.base, input.focus]}
                defaultValue={todayString()}
                required
              />
            </div>

            <div mix={table.actions}>
              <Button type="submit" tone="primary" mix={table.spacer}>
                Create Record
              </Button>
              {(() => {
                let cancelQ = gridStateToParams({ offset, sort, order, filter }).toString()
                let cancelHref = '/client' + (cancelQ ? '?' + cancelQ : '')
                return (
                  <a href={cancelHref} mix={[table.spacer, table.linkPlain]}>
                    <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                      Cancel
                    </Button>
                  </a>
                )
              })()}
            </div>
          </div>
        </div>
      </RestfulForm>
    </div>
  )
  }
}

export { ClientCreatePage }
