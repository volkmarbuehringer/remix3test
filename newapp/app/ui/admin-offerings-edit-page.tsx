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
import { formatMinOption } from '../utils/date-utils.ts'
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

function dayToInputDate(day: string): string {
  return new Date(Number(day)).toISOString().split('T')[0]
}

// Hourly interval options
const START_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const END_MIN_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function parseDuring(during: unknown): { startMin: number; endMin: number } {
  if (typeof during === 'object' && during !== null) {
    let r = during as { lower: number; upper: number }
    return { startMin: Number(r.lower) || 0, endMin: Number(r.upper) || 60 }
  }
  let str = String(during)
  let match = str.match(/^\[(\d+)\s*,\s*(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1], 10), endMin: parseInt(match[2], 10) }
  }
  let fallback = str.match(/\[(\d+)\s*,\s*(\d+)/)
  if (fallback) {
    return { startMin: parseInt(fallback[1], 10), endMin: parseInt(fallback[2], 10) }
  }
  return { startMin: 0, endMin: 60 }
}

// ── Styles (unique to this panel) ──

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

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.id}</span>
              <span mix={table.panelTitle}>Angebot bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-resource">Ressource</label>
                <select
                  id="oe-resource"
                  name="resource_id"
                  required
                  mix={[input.base, input.focus, table.select]}
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
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-day">Tag</label>
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
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-start">Startzeit</label>
                <select
                  id="oe-start"
                  name="start_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === startMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-end">Endzeit</label>
                <select
                  id="oe-end"
                  name="end_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === endMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Speichern
                </Button>
                <a href={buildCancelUrl('/admin/offerings', offset, sort, order, filter)} mix={[table.spacer, table.linkPlain]}>
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
