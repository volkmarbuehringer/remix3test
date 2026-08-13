import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { routes } from '../routes.ts'
import button from '../ui/theme/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { buildCancelUrl } from './mixins/admin-urls.ts'

interface AdminNutzerCreatePageProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

// ── Styles ──

const checkboxRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
})

const checkboxStyle = css({
  width: '16px',
  height: '16px',
  cursor: 'pointer',
  accentColor: theme.colors.action.primary.background,
})

const checkboxLabelStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
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

// ── Component ──

export function AdminNutzerCreatePage(handle: Handle<AdminNutzerCreatePageProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', formValues, fieldErrors } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <form method="POST" action={routes.admin.nutzer.create.href()} novalidate>
          <CsrfTokenInput />
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Nutzer</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-vorname">
                  Vorname
                </label>
                <input
                  id="nc-vorname"
                  name="vorname"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.vorname ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.vorname ?? ''}
                  placeholder="Vorname"
                  maxLength={100}
                />
                {fieldErrors?.vorname ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.vorname}</div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-name">
                  Name
                </label>
                <input
                  id="nc-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? ''}
                  placeholder="Name"
                  maxLength={100}
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-email">
                  Email
                </label>
                <input
                  id="nc-email"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? ''}
                  placeholder="email@example.com"
                  maxLength={200}
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-verpflichtung"
                  name="verpflichtung"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={formValues?.verpflichtung === 'on'}
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-verpflichtung">
                  Verpflichtung
                </label>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-login">
                  Login
                </label>
                <input
                  id="nc-login"
                  name="login"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.login ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.login ?? ''}
                  placeholder="Loginname"
                  maxLength={100}
                />
                {fieldErrors?.login ? <div mix={fieldErrorStyle}>{fieldErrors.login}</div> : null}
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-aktiv"
                  name="aktiv"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={formValues?.aktiv !== undefined ? formValues.aktiv === 'on' : true}
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-aktiv">
                  Aktiv
                </label>
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-gesperrt"
                  name="gesperrt"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={formValues?.gesperrt === 'on'}
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-gesperrt">
                  Gesperrt
                </label>
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.admin.nutzer.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                  )}
                  mix={[table.spacer, table.linkPlain]}
                >
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Abbrechen
                  </button>
                </a>
              </div>
            </div>
          </div>
        </form>
      </div>
    )
  }
}
