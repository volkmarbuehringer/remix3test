import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { buildCancelUrl } from './mixins/admin-urls.ts'
import type { NutzerRow } from './admin-nutzer-page.tsx'

interface AdminNutzerEditPageProps {
  row: NutzerRow
  offset: string
  sort: string
  order: string
  filter?: string
  error?: string
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

// ── Helpers ──

// ── Component ──

export function AdminNutzerEditPage(handle: Handle<AdminNutzerEditPageProps>) {
  return () => {
    let { row, offset, sort, order, filter = '', error } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/nutzer/${row.n_id}`} novalidate>
          <input type="hidden" name="_l_id" value={row.l_id} />
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.n_id}</span>
              <span mix={table.panelTitle}>Nutzer bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              {error ? <div mix={table.errorBanner}>{error}</div> : null}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-vorname">Vorname</label>
                <input
                  id="ne-vorname"
                  name="vorname"
                  type="text"
                  mix={[input.base, input.focus]}
                  value={row.n_vorname ?? ''}
                  placeholder="Vorname"
                  maxLength={100}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-name">Name</label>
                <input
                  id="ne-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus]}
                  value={row.n_name ?? ''}
                  placeholder="Name"
                  maxLength={100}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-email">Email</label>
                <input
                  id="ne-email"
                  name="email"
                  type="email"
                  mix={[input.base, input.focus]}
                  value={row.n_email ?? ''}
                  placeholder="email@example.com"
                  maxLength={200}
                />
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-verpflichtung"
                  name="verpflichtung"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={row.n_verpflichtung}
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-verpflichtung">
                  Verpflichtung
                </label>
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="ne-login">Login</label>
                <input
                  id="ne-login"
                  name="login"
                  type="text"
                  mix={[input.base, input.focus]}
                  value={row.l_login}
                  placeholder="Loginname"
                  maxLength={100}
                />
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-aktiv"
                  name="aktiv"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={row.l_aktiv}
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-aktiv">Aktiv</label>
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="ne-gesperrt"
                  name="gesperrt"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked={row.l_gesperrt}
                />
                <label mix={checkboxLabelStyle} htmlFor="ne-gesperrt">Gesperrt</label>
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Speichern
                </Button>
                <a href={buildCancelUrl('/admin/nutzer', offset, sort, order, filter)} mix={[table.spacer, table.linkPlain]}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Abbrechen
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
