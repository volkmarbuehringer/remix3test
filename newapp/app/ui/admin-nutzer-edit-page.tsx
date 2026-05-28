import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { gridStateToParams } from '../utils/grid-state.ts'
import type { NutzerRow } from './admin-nutzer-page.tsx'

interface AdminNutzerEditPageProps {
  row: NutzerRow
  offset: string
  sort: string
  order: string
  filter?: string
}

// ── Styles ──

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

const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

// ── Helpers ──

function cancelUrl(offset: string, sort: string, order: string, filter?: string): string {
  let qs = gridStateToParams({ offset, sort, order, filter: filter ?? '' }).toString()
  return '/admin/nutzer' + (qs ? '?' + qs : '')
}

// ── Component ──

export function AdminNutzerEditPage(handle: Handle<AdminNutzerEditPageProps>) {
  return () => {
    let { row, offset, sort, order, filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/nutzer/${row.n_id}`}>
          <input type="hidden" name="_l_id" value={row.l_id} />
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={rowIdBadgeStyle}>#{row.n_id}</span>
              <span mix={panelTitleStyle}>Nutzer bearbeiten</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ne-vorname">Vorname</label>
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

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ne-name">Name</label>
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

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ne-email">Email</label>
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

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="ne-login">Login</label>
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

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Speichern
                </Button>
                <a href={cancelUrl(offset, sort, order, filter)} style={{ flex: 1, textDecoration: 'none' }}>
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
