import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { formatMinOption } from '../utils/date-utils.ts'
import type { GridState } from '../utils/grid-state.ts'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'

const inlineErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

const dayListStyle = css({
  listStyle: 'none',
  padding: 0,
  margin: 0,
})

const dayItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  '&:last-child': { borderBottom: 'none' },
})

const dayLabelStyle = css({
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  flex: 1,
})

const dayDateStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const dayRangeStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  marginTop: '2px',
})

const emptyStyle = css({
  padding: `${theme.space.md} ${theme.space.sm}`,
  textAlign: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

function formatDate(epochMs: number): string {
  return new Date(Number(epochMs)).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatRangeLabel(ranges: { startMin: number; endMin: number }[]): string {
  return ranges.map(r => `${formatMinOption(r.startMin)}–${formatMinOption(r.endMin)}`).join(', ')
}

function buildPeriodUrl(base: string, period: string | null, resourceId: string, gridState: GridState): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  params.set('step', '2')
  params.set('resource_id', resourceId)
  if (period) params.set('period', period)
  if (gridState.offset) params.set('offset', gridState.offset)
  if (gridState.sort) params.set('sort', gridState.sort)
  if (gridState.order) params.set('order', gridState.order)
  if (gridState.filter) params.set('filter', gridState.filter)
  if (gridState.status) params.set('status', gridState.status)
  return base + '?' + params.toString()
}

function buildBackUrl(base: string, resourceId: string, gridState: GridState): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  params.set('step', '1')
  params.set('resource_id', resourceId)
  if (gridState.period) params.set('period', gridState.period)
  if (gridState.offset) params.set('offset', gridState.offset)
  if (gridState.sort) params.set('sort', gridState.sort)
  if (gridState.order) params.set('order', gridState.order)
  if (gridState.filter) params.set('filter', gridState.filter)
  if (gridState.status) params.set('status', gridState.status)
  return base + '?' + params.toString()
}

interface WizardStep2Props {
  resourceId: string
  daysWithOfferings: { day: number; ranges: { startMin: number; endMin: number }[] }[]
  gridState: GridState
  fieldErrors?: Record<string, string>
}

export function WizardStep2(handle: Handle<WizardStep2Props>) {
  return () => {
    let { resourceId, daysWithOfferings, gridState, fieldErrors } = handle.props
    let period = gridState.period || ''
    let base = routes.appointmentsNew.index.href()

    let periodButtons = (['', 'this-week', 'next-week', 'this-month', 'next-month'] as const).map((value, i, arr) => {
      let isFirst = i === 0
      let isLast = i === arr.length - 1
      let label = value === '' ? 'Alle' : { 'this-week': 'Diese Woche', 'next-week': 'Nächste Woche', 'this-month': 'Diesen Monat', 'next-month': 'Nächsten Monat' }[value]
      let active = value === '' ? !period : period === value
      let href = buildPeriodUrl(base, active ? null : value, resourceId, gridState)
      return (
        <a
          key={value}
          href={href}
          mix={css({
            '& button': {
              paddingLeft: theme.space.sm,
              paddingRight: theme.space.sm,
              borderTopLeftRadius: isFirst ? undefined : '0',
              borderBottomLeftRadius: isFirst ? undefined : '0',
              borderTopRightRadius: isLast ? undefined : '0',
              borderBottomRightRadius: isLast ? undefined : '0',
              borderRight: isLast ? '0' : `1px solid ${theme.colors.border}`,
            },
          })}
        >
          <Button tone={active ? 'primary' : 'secondary'}>{label}</Button>
        </a>
      )
    })

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action={base} novalidate>
          <input type="hidden" name="_offset" value={gridState.offset} />
          <input type="hidden" name="_sort" value={gridState.sort} />
          <input type="hidden" name="_order" value={gridState.order} />
          <input type="hidden" name="_filter" value={gridState.filter} />
          <input type="hidden" name="_period" value={gridState.period ?? ''} />
          <input type="hidden" name="_status" value={gridState.status ?? ''} />
          <input type="hidden" name="step" value="2" />
          <input type="hidden" name="resource_id" value={resourceId} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Termin – Schritt 2: Tag wählen</span>
            </div>
            <div mix={table.panelBody}>
              <div mix={css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.space.xs,
                marginBottom: theme.space.sm,
              })}>
                {periodButtons}
              </div>

              {daysWithOfferings.length === 0 ? (
                <div mix={emptyStyle}>Keine verfügbaren Tage in diesem Zeitraum</div>
              ) : (
                <ul mix={dayListStyle}>
                  {daysWithOfferings.map(({ day, ranges }) => (
                    <li key={day} mix={dayItemStyle}>
                      <input
                        type="radio"
                        name="day"
                        value={String(day)}
                        id={`day-${day}`}
                        mix={css({ cursor: 'pointer' })}
                      />
                      <label htmlFor={`day-${day}`} mix={dayLabelStyle}>
                        <span mix={dayDateStyle}>{formatDate(day)}</span>
                        <span mix={dayRangeStyle}>{formatRangeLabel(ranges)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {fieldErrors?.day ? <span mix={inlineErrorStyle}>{fieldErrors.day}</span> : null}

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer} disabled={daysWithOfferings.length === 0}>
                  Weiter
                </Button>
                <a href={buildBackUrl(base, resourceId, gridState)} mix={table.linkPlain}>
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
