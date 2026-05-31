import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { buildCancelUrl } from './mixins/admin-urls.ts'

interface AdminNutzerCreatePageProps {
  offset?: string
  sort?: string
  order?: string
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

// ── Component ──

export function AdminNutzerCreatePage(handle: Handle<AdminNutzerCreatePageProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/nutzer">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Neuer Nutzer</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="nc-vorname">Vorname</label>
                <input
                  id="nc-vorname"
                  name="vorname"
                  type="text"
                  mix={[input.base, input.focus]}
                  placeholder="Vorname"
                  maxLength={100}
                />
              </div>

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="nc-name">Name</label>
                <input
                  id="nc-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus]}
                  placeholder="Name"
                  maxLength={100}
                />
              </div>

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="nc-email">Email</label>
                <input
                  id="nc-email"
                  name="email"
                  type="email"
                  mix={[input.base, input.focus]}
                  placeholder="email@example.com"
                  maxLength={200}
                />
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-verpflichtung"
                  name="verpflichtung"
                  type="checkbox"
                  mix={checkboxStyle}
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-verpflichtung">
                  Verpflichtung
                </label>
              </div>

              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="nc-login">Login</label>
                <input
                  id="nc-login"
                  name="login"
                  type="text"
                  mix={[input.base, input.focus]}
                  placeholder="Loginname"
                  maxLength={100}
                />
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-aktiv"
                  name="aktiv"
                  type="checkbox"
                  mix={checkboxStyle}
                  checked
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-aktiv">Aktiv</label>
              </div>

              <div mix={checkboxRowStyle}>
                <input
                  id="nc-gesperrt"
                  name="gesperrt"
                  type="checkbox"
                  mix={checkboxStyle}
                />
                <label mix={checkboxLabelStyle} htmlFor="nc-gesperrt">Gesperrt</label>
              </div>

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Anlegen
                </Button>
                <a href={buildCancelUrl('/admin/nutzer', offset, sort, order, filter)} style={{ flex: 1, textDecoration: 'none' }}>
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
