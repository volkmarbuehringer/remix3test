import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { Button } from 'remix/components/button'

import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { formatMinOption, getCurrentWeekMonday, formatWeekLabel, formatDateDE } from '../utils/date-utils.ts'
import type { GridState } from '../utils/grid-state.ts'
import type { DayWithSlots } from '../actions/appointments-new/controller.tsx'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'

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

const dayCard = css({
  display: 'flex',
  flexDirection: 'column',
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  '&:last-child': { borderBottom: 'none' },
})

const dayHeader = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  cursor: 'pointer',
  marginBottom: theme.space.xs,
})

const dayDateLabel = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const dayRangeLabel = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  marginLeft: 'auto',
})

const timeChips = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  paddingLeft: '24px',
})

const timeChip = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
  transition: 'border-color 150ms ease, background 150ms ease',
  '&:has(input:checked)': {
    borderColor: theme.colors.action.primary.background,
    background: `${theme.colors.action.primary.background}15`,
    color: theme.colors.action.primary.background,
    fontWeight: theme.fontWeight.semibold,
  },
  '& input': {
    display: 'none',
  },
})

const emptyStyle = css({
  padding: `${theme.space.md} ${theme.space.sm}`,
  textAlign: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

function formatRangeLabel(ranges: { startMin: number; endMin: number }[]): string {
  return ranges.map(r => `${formatMinOption(r.startMin)}–${formatMinOption(r.endMin)}`).join(', ')
}

interface Step2Props {
  resourceId: string
  weekStart: number
  daysWithSlots: DayWithSlots[]
  gridState: GridState
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

export function Step2(handle: Handle<Step2Props>) {
  return () => {
    let { resourceId, weekStart, daysWithSlots, gridState, formValues, fieldErrors, formError } = handle.props
    let base = routes.appointmentsNew.index.href()
    let currentWeekMonday = getCurrentWeekMonday()
    let isCurrentWeek = weekStart === currentWeekMonday
    let prevWeekStart = weekStart - 7 * 86_400_000
    let nextWeekStart = weekStart + 7 * 86_400_000
    function buildWeekUrl(ws: number): string {
      let params = new URLSearchParams()
      params.set('creating', 'true')
      params.set('step', '2')
      params.set('resource_id', resourceId)
      params.set('week_start', String(ws))
      if (gridState.offset) params.set('offset', gridState.offset)
      if (gridState.sort) params.set('sort', gridState.sort)
      if (gridState.order) params.set('order', gridState.order)
      if (gridState.filter) params.set('filter', gridState.filter)
      if (gridState.period) params.set('period', gridState.period)
      if (gridState.status) params.set('status', gridState.status)
      return base + '?' + params.toString()
    }

    function buildBackUrl(ws: number): string {
      let params = new URLSearchParams()
      params.set('creating', 'true')
      params.set('step', '1')
      if (gridState.period) params.set('period', gridState.period)
      if (gridState.offset) params.set('offset', gridState.offset)
      if (gridState.sort) params.set('sort', gridState.sort)
      if (gridState.order) params.set('order', gridState.order)
      if (gridState.filter) params.set('filter', gridState.filter)
      if (gridState.status) params.set('status', gridState.status)
      return base + '?' + params.toString()
    }

    return (
      <div>
        <RestfulForm method="POST" action={base} novalidate>
          <input type="hidden" name="_offset" value={gridState.offset} />
          <input type="hidden" name="_sort" value={gridState.sort} />
          <input type="hidden" name="_order" value={gridState.order} />
          <input type="hidden" name="_filter" value={gridState.filter} />
          <input type="hidden" name="_period" value={gridState.period ?? ''} />
          <input type="hidden" name="_status" value={gridState.status ?? ''} />
          <input type="hidden" name="step" value="2" />
          <input type="hidden" name="resource_id" value={resourceId} />
          <input type="hidden" name="week_start" value={String(weekStart)} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Termin – Schritt 2: Tag und Zeit</span>
            </div>
            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              <div mix={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: theme.space.sm,
              })}>
                {isCurrentWeek ? (
                  <span mix={css({ opacity: 0.4, fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}>
                    ◀ Vorherige
                  </span>
                ) : (
                  <a href={buildWeekUrl(prevWeekStart)} mix={css({ textDecoration: 'none' })}>
                    <Button type="button" tone="secondary">◀ Vorherige</Button>
                  </a>
                )}
                <span mix={css({ fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.sm })}>
                  {formatWeekLabel(weekStart)}
                </span>
                <a href={buildWeekUrl(nextWeekStart)} mix={css({ textDecoration: 'none' })}>
                  <Button type="button" tone="secondary">Nächste ▶</Button>
                </a>
              </div>

              {daysWithSlots.length === 0 ? (
                <div mix={emptyStyle}>Keine verfügbaren Tage in dieser Woche</div>
              ) : (
                <ul mix={css({ listStyle: 'none', padding: 0, margin: 0, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.md, overflow: 'hidden' })}>
                  {daysWithSlots.map((dws) => (
                    <li key={dws.day} mix={dayCard}>
                      <div mix={dayHeader}>
                        <span mix={dayDateLabel}>{formatDateDE(dws.day)}</span>
                        <span mix={dayRangeLabel}>{formatRangeLabel(dws.ranges)}</span>
                      </div>
                      <div mix={timeChips}>
                        {dws.slots.map((min) => {
                          let combinedValue = `${dws.day}:${min}`
                          return (
                            <label key={min} mix={timeChip}>
                              <input
                                type="radio"
                                name="day_start"
                                value={combinedValue}
                                defaultChecked={formValues?.day_start === combinedValue}
                              />
                              {formatMinOption(min)}
                            </label>
                          )
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {fieldErrors?.day_start ? <span mix={inlineErrorStyle}>{fieldErrors.day_start}</span> : null}

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="wiz-title">Titel (optional)</label>
                <input
                  id="wiz-title"
                  name="title"
                  type="text"
                  placeholder="Titel eingeben..."
                  mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                  value={formValues?.title ?? ''}
                />
                {fieldErrors?.title ? <span mix={inlineErrorStyle}>{fieldErrors.title}</span> : null}
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer} disabled={daysWithSlots.length === 0}>
                  Anlegen
                </Button>
                <a href={buildBackUrl(weekStart)} mix={table.linkPlain}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Zurück
                  </Button>
                </a>
                <a href={buildCancelUrl(base, gridState.offset, gridState.sort, gridState.order, gridState.filter, gridState.period, gridState.status)} mix={[table.spacer, table.linkPlain]}>
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
