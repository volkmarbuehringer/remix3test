import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { buildCancelUrl } from './mixins/admin-urls.ts'
import { formatMinOption } from '../utils/date-utils.ts'
import type { ResourceOption } from '../actions/admin-offerings-controller.tsx'

interface AdminOfferingsCreatePageProps {
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
}

// Hourly interval options
const START_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const END_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

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

const selectStyle = css({
  width: '100%',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
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

export function AdminOfferingsCreatePage(handle: Handle<AdminOfferingsCreatePageProps>) {
  return () => {
    let { resources, offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/offerings">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Neues Angebot</span>
            </div>

            <div mix={panelBodyStyle}>
              {/* Resource dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oc-resource">Ressource</label>
                <select
                  id="oc-resource"
                  name="resource_id"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  <option value="" disabled selected>Ressource auswählen...</option>
                  {resources.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date input */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oc-day">Tag</label>
                <input
                  id="oc-day"
                  name="day"
                  type="date"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              {/* Start time dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oc-start">Startzeit</label>
                <select
                  id="oc-start"
                  name="start_min"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === 480}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              {/* End time dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oc-end">Endzeit</label>
                <select
                  id="oc-end"
                  name="end_min"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === 1020}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Anlegen
                </Button>
                <a href={buildCancelUrl('/admin/offerings', offset, sort, order, filter)} mix={css({ flex: 1, textDecoration: 'none' })}>
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
