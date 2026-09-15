import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import button, { buttonLink } from '../../ui/theme/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../../utils/motion.ts'
import { input } from '../../ui/mixins/input.ts'
import { table } from '../../ui/mixins/admin-table.ts'
import { RestfulForm } from '../../ui/restful-form.tsx'
import { GridStateHiddenInputs } from '../../ui/grid-state-hidden.tsx'
import { gridStateToParams } from '../../utils/grid-state.ts'
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
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientCreatePageProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
}

function ClientCreatePage(handle: Handle<ClientCreatePageProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method="POST"
          action={routes.admin.clients.index.href()}
          data-rmx-target={getSelfFrameTarget()}
        >
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Kunde</span>
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
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? ''}
                  placeholder="Vollständigen Namen eingeben"
                  required
                  maxLength={100}
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-email">
                  E-Mail <span mix={requiredStarStyle}>*</span>
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
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-role">
                  Rolle
                </label>
                <select id="cf-role" name="role" mix={[input.base, input.focus, selectStyle]}>
                  <option value="Viewer" selected={!formValues || formValues.role === 'Viewer'}>
                    Viewer
                  </option>
                  <option value="Editor" selected={formValues?.role === 'Editor'}>
                    Editor
                  </option>
                  <option value="Admin" selected={formValues?.role === 'Admin'}>
                    Admin
                  </option>
                </select>
                <div mix={fieldHintStyle}>Berechtigungsstufe</div>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-status">
                  Status
                </label>
                <select id="cf-status" name="status" mix={[input.base, input.focus, selectStyle]}>
                  <option value="Active" selected={!formValues || formValues.status === 'Active'}>
                    Active
                  </option>
                  <option value="Inactive" selected={formValues?.status === 'Inactive'}>
                    Inactive
                  </option>
                </select>
                <div mix={fieldHintStyle}>Aktivierungsstatus</div>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="cf-registered">
                  Registriert <span mix={requiredStarStyle}>*</span>
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
                  value={formValues?.registered ?? todayString()}
                  required
                />
                {fieldErrors?.registered ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.registered}</div>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                {(() => {
                  let cancelQ = gridStateToParams({ offset, sort, order, filter }).toString()
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
        </RestfulForm>
      </div>
    )
  }
}

export { ClientCreatePage }
