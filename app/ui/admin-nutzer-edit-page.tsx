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
import type { NutzerRow } from '../data/nutzer.ts'

interface AdminNutzerEditPageProps {
  row: NutzerRow
  offset: string
  sort: string
  order: string
  filter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

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

export function AdminNutzerEditPage(handle: Handle<AdminNutzerEditPageProps>) {
  return () => {
    let { row, offset, sort, order, filter = '', formValues, fieldErrors } = handle.props
    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <form method="POST" action={routes.admin.nutzer.update.href({ id: row.n_id })} novalidate>
          <input type="hidden" name="_method" value="PUT" />
          <CsrfTokenInput />
          <input type="hidden" name="_l_id" value={row.l_id} />
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.n_id}</span>
              <span mix={table.panelTitle}>Nutzer bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-vorname">
                  Vorname
                </label>
                <input
                  id="ne-vorname"
                  name="vorname"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.vorname ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.vorname ?? row.n_vorname ?? ''}
                  placeholder="Vorname"
                  maxLength={100}
                />
                {fieldErrors?.vorname ? (
                  <div mix={fieldErrorStyle}>{fieldErrors.vorname}</div>
                ) : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-name">
                  Name
                </label>
                <input
                  id="ne-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(
                    Boolean,
                  )}
                  value={formValues?.name ?? row.n_name ?? ''}
                  placeholder="Name"
                  maxLength={100}
                />
                {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-email">
                  Email
                </label>
                <input
                  id="ne-email"
                  name="email"
                  type="email"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.email ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.email ?? row.n_email ?? ''}
                  placeholder="email@example.com"
                  maxLength={200}
                />
                {fieldErrors?.email ? <div mix={fieldErrorStyle}>{fieldErrors.email}</div> : null}
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-verpflichtung"
                  name="verpflichtung"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={
                    formValues?.verpflichtung !== undefined
                      ? formValues.verpflichtung === 'on'
                      : row.n_verpflichtung
                  }
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-verpflichtung">
                  Verpflichtung
                </label>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-login">
                  Login
                </label>
                <input
                  id="ne-login"
                  name="login"
                  type="text"
                  mix={[
                    input.base,
                    input.focus,
                    fieldErrors?.login ? inputErrorStyle : null,
                  ].filter(Boolean)}
                  value={formValues?.login ?? row.l_login}
                  placeholder="Loginname"
                  maxLength={100}
                />
                {fieldErrors?.login ? <div mix={fieldErrorStyle}>{fieldErrors.login}</div> : null}
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-aktiv"
                  name="aktiv"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={
                    formValues?.aktiv !== undefined ? formValues.aktiv === 'on' : row.l_aktiv
                  }
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-aktiv">
                  Aktiv
                </label>
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-gesperrt"
                  name="gesperrt"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={
                    formValues?.gesperrt !== undefined
                      ? formValues.gesperrt === 'on'
                      : row.l_gesperrt
                  }
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-gesperrt">
                  Gesperrt
                </label>
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
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
