import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import button from '../ui/theme/button.ts'

import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import {
  formatMinOption,
  getCurrentWeekMonday,
  formatWeekLabel,
  formatDateDE,
} from '../utils/date-utils.ts'
import type { GridState } from '../utils/grid-state.ts'
import type { DayWithSlots } from '../data/appointments.ts'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'
import { AppointmentsNewStep2Live } from './appointments-new-step2.browser.tsx'

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

const resourceSummary = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: `${theme.space.sm} ${theme.space.md}`,
  marginBottom: theme.space.md,
  background: theme.surface.lvl2,
  borderRadius: theme.radius.md,
})

const resourceSummaryLabel = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const resourceSummaryName = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const resourceSummaryDesc = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

const confirmLine = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  marginBottom: theme.space.md,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  minHeight: '2.5rem',
  display: 'flex',
  alignItems: 'center',
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
  '&:has(input:focus-visible)': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const hiddenRadio = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
})

const timeGroup = css({
  border: 'none',
  padding: 0,
  margin: 0,
})

const timeGroupLegend = css({
  padding: 0,
  marginBottom: theme.space.sm,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

const emptyStyle = css({
  padding: `${theme.space.md} ${theme.space.sm}`,
  textAlign: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const weekNavBtnCss = css({
  '@media (max-width: 768px)': {
    minHeight: '44px',
  },
})

function formatRangeLabel(ranges: { startMin: number; endMin: number }[]): string {
  return ranges.map((r) => `${formatMinOption(r.startMin)}–${formatMinOption(r.endMin)}`).join(', ')
}

interface Step2Props {
  resourceId: string
  resourceName?: string | undefined
  resourceDescription?: string | undefined
  weekStart: number
  daysWithSlots: DayWithSlots[]
  gridState: GridState
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

export function Step2(handle: Handle<Step2Props>) {
  return () => {
    let {
      resourceId,
      resourceName,
      resourceDescription,
      weekStart,
      daysWithSlots,
      gridState,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let base = routes.appointmentsNew.index.href()
    let currentWeekMonday = getCurrentWeekMonday()
    let isCurrentWeek = weekStart === currentWeekMonday
    let prevWeekStart = weekStart - 7 * 86_400_000
    let nextWeekStart = weekStart + 7 * 86_400_000

    // Only surface a previously-selected time if a radio for that exact slot is
    // actually rendered — on an overlap re-render the just-created slot is
    // removed from daysWithSlots, so a stale confirmation would claim a time
    // that no longer exists.
    let validDayStartValues = new Set<string>()
    for (let dws of daysWithSlots) {
      for (let min of dws.slots) {
        validDayStartValues.add(`${dws.day}:${min}`)
      }
    }

    let selectedConfirm = ''
    if (formValues?.day_start && validDayStartValues.has(formValues.day_start)) {
      let [dayMsRaw, minRaw] = formValues.day_start.split(':')
      let dayMs = Number(dayMsRaw)
      let min = Number(minRaw)
      if (Number.isFinite(dayMs) && Number.isFinite(min)) {
        selectedConfirm = `${formatDateDE(dayMs)} – ${formatMinOption(min)} Uhr`
      }
    }

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
        <AppointmentsNewStep2Live />
        <RestfulForm method="POST" action={base} novalidate data-wizard-form="true">
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
              <span mix={table.panelTitle}>Neuer Termin – Schritt 2 von 2: Tag und Zeit</span>
            </div>
            <div mix={table.panelBody}>
              {resourceName ? (
                <div mix={resourceSummary}>
                  <span mix={resourceSummaryLabel}>Gewählte Ressource</span>
                  <span mix={resourceSummaryName}>{resourceName}</span>
                  {resourceDescription ? (
                    <span mix={resourceSummaryDesc}>{resourceDescription}</span>
                  ) : null}
                </div>
              ) : null}

              <div mix={confirmLine} data-wizard-confirm>
                {selectedConfirm || 'Noch keine Uhrzeit gewählt.'}
              </div>

              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              <div
                mix={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: theme.space.sm,
                  marginBottom: theme.space.sm,
                  '@media (max-width: 768px)': {
                    rowGap: theme.space.sm,
                  },
                })}
              >
                {isCurrentWeek ? (
                  <span
                    mix={css({
                      opacity: 0.4,
                      fontSize: theme.fontSize.sm,
                      color: theme.colors.text.muted,
                    })}
                  >
                    ◀ Vorherige
                  </span>
                ) : (
                  <a href={buildWeekUrl(prevWeekStart)} mix={css({ textDecoration: 'none' })}>
                    <button type="button" mix={[button({ tone: 'secondary' }), weekNavBtnCss]}>
                      ◀ Vorherige
                    </button>
                  </a>
                )}
                <span
                  mix={css({
                    fontWeight: theme.fontWeight.semibold,
                    fontSize: theme.fontSize.sm,
                    textAlign: 'center',
                    '@media (max-width: 768px)': {
                      flexBasis: '100%',
                      order: -1,
                    },
                  })}
                >
                  {formatWeekLabel(weekStart)}
                </span>
                <a href={buildWeekUrl(nextWeekStart)} mix={css({ textDecoration: 'none' })}>
                  <button type="button" mix={[button({ tone: 'secondary' }), weekNavBtnCss]}>
                    Nächste ▶
                  </button>
                </a>
              </div>

              {daysWithSlots.length === 0 ? (
                <div mix={emptyStyle}>
                  Für diese Ressource sind derzeit keine freien Termine verfügbar. Wechseln Sie die
                  Woche (◀ / ▶) oder wählen Sie eine andere Ressource.
                </div>
              ) : (
                <fieldset mix={timeGroup}>
                  <legend mix={timeGroupLegend}>Uhrzeit wählen</legend>
                  <ul
                    mix={css({
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      border: `1px solid ${theme.colors.border.subtle}`,
                      borderRadius: theme.radius.md,
                      overflow: 'hidden',
                    })}
                  >
                    {daysWithSlots.map((dws) => (
                      <li key={dws.day} mix={dayCard}>
                        <div mix={dayHeader}>
                          <span mix={dayDateLabel}>{formatDateDE(dws.day)}</span>
                          <span mix={dayRangeLabel}>{formatRangeLabel(dws.ranges)}</span>
                        </div>
                        <div mix={timeChips}>
                          {dws.slots.map((min) => {
                            let combinedValue = `${dws.day}:${min}`
                            let inputId = `wiz-time-${dws.day}-${min}`
                            return (
                              <label key={min} mix={timeChip} htmlFor={inputId}>
                                <input
                                  id={inputId}
                                  type="radio"
                                  name="day_start"
                                  value={combinedValue}
                                  mix={hiddenRadio}
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
                </fieldset>
              )}
              {fieldErrors?.day_start ? (
                <span mix={inlineErrorStyle}>{fieldErrors.day_start}</span>
              ) : null}

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="wiz-title">
                  Titel (optional)
                </label>
                <input
                  id="wiz-title"
                  name="title"
                  type="text"
                  placeholder="Titel eingeben..."
                  mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                  value={formValues?.title ?? ''}
                />
                {fieldErrors?.title ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.title}</span>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button
                  type="submit"
                  disabled={daysWithSlots.length === 0}
                  data-wizard-submit
                  mix={[button({ tone: 'primary' }), table.spacer]}
                >
                  Anlegen
                </button>
                <a href={buildBackUrl(weekStart)} mix={table.linkPlain}>
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Zurück
                  </button>
                </a>
                <a
                  href={buildCancelUrl(
                    base,
                    gridState.offset,
                    gridState.sort,
                    gridState.order,
                    gridState.filter,
                    gridState.period,
                    gridState.status,
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
        </RestfulForm>
      </div>
    )
  }
}
