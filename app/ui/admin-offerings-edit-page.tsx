import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'
import { formatMinOption } from '../utils/date-utils.ts'
import type { OfferingRow, OfferingsResourceOption } from '../actions/verwaltung/controller.tsx'

interface AdminOfferingsEditPageProps {
  row: OfferingRow
  resources: OfferingsResourceOption[]
  offset: string
  sort: string
  order: string
  filter?: string
  period?: string
  status?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
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

// ── Styles ──

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

const inlineErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

const formErrorBanner = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  marginBottom: theme.space.sm,
  background: `${theme.colors.action.danger.background}15`,
  border: `1px solid ${theme.colors.action.danger.background}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
})

// ── Component ──

export function AdminOfferingsEditPage(handle: Handle<AdminOfferingsEditPageProps>) {
  return () => {
    let { row, resources, offset, sort, order, filter = '', period = '', status = '', formValues, fieldErrors, formError } = handle.props
    let { startMin: rowStartMin, endMin: rowEndMin } = parseDuring(row.during)
    let dateValue = dayToInputDate(row.day)

    let resolvedResourceId = formValues?.resource_id ?? row.resource_id
    let resolvedDay = formValues?.day ?? dateValue
    let resolvedStartMin = formValues?.start_min ? Number(formValues.start_min) : rowStartMin
    let resolvedEndMin = formValues?.end_min ? Number(formValues.end_min) : rowEndMin

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="PUT" action={routes.verwaltung.offerings.update.href({ id: row.id })} novalidate>
          <GridStateHiddenInputs state={{ offset, sort, order, filter, period, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={rowIdBadgeStyle}>#{row.id}</span>
              <span mix={table.panelTitle}>Angebot bearbeiten</span>
            </div>

            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-resource">Ressource</label>
                <select
                  id="oe-resource"
                  name="resource_id"
                  required
                  mix={fieldErrors?.resource_id ? [input.base, input.error, input.focus, table.select] : [input.base, input.focus, table.select]}
                >
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={String(resolvedResourceId) === String(res.id)}
                    >
                      {res.description}
                    </option>
                  ))}
                </select>
                {fieldErrors?.resource_id ? <span mix={inlineErrorStyle}>{fieldErrors.resource_id}</span> : null}
              </div>

              {/* Date input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-day">Tag</label>
                <input
                  id="oe-day"
                  name="day"
                  type="date"
                  required
                  mix={fieldErrors?.day ? [input.base, input.error, input.focus] : [input.base, input.focus]}
                  value={resolvedDay}
                />
                {fieldErrors?.day ? <span mix={inlineErrorStyle}>{fieldErrors.day}</span> : null}
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-start">Startzeit</label>
                <select
                  id="oe-start"
                  name="start_min"
                  required
                  mix={fieldErrors?.start_min ? [input.base, input.error, input.focus, table.select] : [input.base, input.focus, table.select]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === resolvedStartMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
                {fieldErrors?.start_min ? <span mix={inlineErrorStyle}>{fieldErrors.start_min}</span> : null}
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oe-end">Endzeit</label>
                <select
                  id="oe-end"
                  name="end_min"
                  required
                  mix={fieldErrors?.end_min ? [input.base, input.error, input.focus, table.select] : [input.base, input.focus, table.select]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === resolvedEndMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
                {fieldErrors?.end_min ? <span mix={inlineErrorStyle}>{fieldErrors.end_min}</span> : null}
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Speichern
                </Button>
                <a href={buildCancelUrl(routes.verwaltung.offerings.index.href(), offset, sort, order, filter, period, status)} mix={[table.spacer, table.linkPlain]}>
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
