import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { gridStateToParams } from '../utils/grid-state.ts'
import type { OfferingRow, ResourceOption } from '../actions/admin-offerings-controller.tsx'

interface AdminOfferingsEditPageProps {
  row: OfferingRow
  resources: ResourceOption[]
  offset: string
  sort: string
  order: string
  filter?: string
}

// ── Helpers ──

function parseDuring(during: unknown): { startMin: number; endMin: number } {
  // Handle pg int4range object format: { lower: 480, upper: 1020 }
  if (typeof during === 'object' && during !== null) {
    let r = during as { lower: number; upper: number }
    return { startMin: Number(r.lower) || 0, endMin: Number(r.upper) || 60 }
  }
  // Handle string format: "[480,1020)" or "[480, 1020)" (pg may include spaces)
  let str = String(during)
  let match = str.match(/^\[(\d+)\s*,\s*(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1], 10), endMin: parseInt(match[2], 10) }
  }
  // Fallback: try to extract any two numbers within brackets
  let fallback = str.match(/\[(\d+)\s*,\s*(\d+)/)
  if (fallback) {
    return { startMin: parseInt(fallback[1], 10), endMin: parseInt(fallback[2], 10) }
  }
  return { startMin: 0, endMin: 60 }
}

function dayToInputDate(day: string): string {
  return new Date(Number(day)).toISOString().split('T')[0]
}

function cancelUrl(offset: string, sort: string, order: string, filter?: string): string {
  let qs = gridStateToParams({ offset, sort, order, filter: filter ?? '' }).toString()
  return '/admin/offerings' + (qs ? '?' + qs : '')
}

// Hourly interval options
const START_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const END_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function formatMinOption(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
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

// ── Component ──

export function AdminOfferingsEditPage(handle: Handle<AdminOfferingsEditPageProps>) {
  return () => {
    let { row, resources, offset, sort, order, filter = '' } = handle.props
    let { startMin, endMin } = parseDuring(row.during)
    let dateValue = dayToInputDate(row.day)

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={`/admin/offerings/${row.id}`}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={rowIdBadgeStyle}>#{row.id}</span>
              <span mix={panelTitleStyle}>Angebot bearbeiten</span>
            </div>

            <div mix={panelBodyStyle}>
              {/* Resource dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oe-resource">Ressource</label>
                <select
                  id="oe-resource"
                  name="resource_id"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={res.id === row.resource_id}
                    >
                      {res.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date input */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oe-day">Tag</label>
                <input
                  id="oe-day"
                  name="day"
                  type="date"
                  required
                  mix={[input.base, input.focus]}
                  value={dateValue}
                />
              </div>

              {/* Start time dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oe-start">Startzeit</label>
                <select
                  id="oe-start"
                  name="start_min"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === startMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              {/* End time dropdown */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} htmlFor="oe-end">Endzeit</label>
                <select
                  id="oe-end"
                  name="end_min"
                  required
                  mix={[input.base, input.focus, selectStyle]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === endMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
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
