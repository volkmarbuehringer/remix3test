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

interface AdminNutzerCreatePageProps {
  offset?: string
  sort?: string
  order?: string
  filter?: string
  error?: string
}

// ── Styles (unique to this panel) ──

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

export function AdminNutzerCreatePage(handle: Handle<AdminNutzerCreatePageProps>) {
  return () => {
    let { offset = '', sort = '', order = '', filter = '', error } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/nutzer" novalidate>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Nutzer</span>
            </div>

            <div mix={table.panelBody}>
              {error ? <div mix={table.errorBanner}>{error}</div> : null}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-vorname">Vorname</label>
                <input
                  id="nc-vorname"
                  name="vorname"
                  type="text"
                  mix={[input.base, input.focus]}
                  placeholder="Vorname"
                  maxLength={100}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-name">Name</label>
                <input
                  id="nc-name"
                  name="name"
                  type="text"
                  mix={[input.base, input.focus]}
                  placeholder="Name"
                  maxLength={100}
                />
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-email">Email</label>
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

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="nc-login">Login</label>
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

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Anlegen
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
