import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
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

function buildBackUrl(resourceId: string, gridState: GridState): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  params.set('step', '2')
  params.set('resource_id', resourceId)
  if (gridState.period) params.set('period', gridState.period)
  if (gridState.offset) params.set('offset', gridState.offset)
  if (gridState.sort) params.set('sort', gridState.sort)
  if (gridState.order) params.set('order', gridState.order)
  if (gridState.filter) params.set('filter', gridState.filter)
  if (gridState.status) params.set('status', gridState.status)
  return routes.appointmentsNew.index.href() + '?' + params.toString()
}

const emptyStyle = css({
  padding: `${theme.space.md} ${theme.space.sm}`,
  textAlign: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

interface WizardStep3Props {
  resourceId: string
  day: number
  fullHourSlots: number[]
  gridState: GridState
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

const formErrorBanner = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  marginBottom: theme.space.sm,
  background: `${theme.colors.action.danger.background}15`,
  border: `1px solid ${theme.colors.action.danger.background}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
})

export function WizardStep3(handle: Handle<WizardStep3Props>) {
  return () => {
    let { resourceId, day, fullHourSlots, gridState, formValues, fieldErrors, formError } = handle.props
    let resolvedStartMin = formValues?.start_min !== undefined ? Number(formValues.start_min) : (fullHourSlots.length > 0 ? fullHourSlots[0] : undefined)
    let resolvedTitle = formValues?.title ?? ''

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action={routes.appointmentsNew.index.href()} novalidate>
          <input type="hidden" name="_offset" value={gridState.offset} />
          <input type="hidden" name="_sort" value={gridState.sort} />
          <input type="hidden" name="_order" value={gridState.order} />
          <input type="hidden" name="_filter" value={gridState.filter} />
          <input type="hidden" name="_period" value={gridState.period ?? ''} />
          <input type="hidden" name="_status" value={gridState.status ?? ''} />
          <input type="hidden" name="step" value="3" />
          <input type="hidden" name="resource_id" value={resourceId} />
          <input type="hidden" name="date" value={new Date(Number(day)).toISOString().split('T')[0]} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Termin – Schritt 3: Zeit und Titel</span>
            </div>
            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}
              {fullHourSlots.length === 0 ? (
                <div mix={emptyStyle}>Keine verfügbaren Zeitfenster an diesem Tag</div>
              ) : (
                <>
                  <div mix={table.fieldGroup}>
                    <label mix={table.label} htmlFor="wiz-start">Startzeit</label>
                    <select
                      id="wiz-start"
                      name="start_min"
                      required
                      mix={[input.base, input.focus, table.select, fieldErrors?.start_min ? input.error : undefined]}
                    >
                      {fullHourSlots.map((min) => (
                        <option key={min} value={min} selected={min === resolvedStartMin}>
                          {formatMinOption(min)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors?.start_min ? <span mix={inlineErrorStyle}>{fieldErrors.start_min}</span> : null}
                  </div>

                  <div mix={table.fieldGroup}>
                    <label mix={table.label} htmlFor="wiz-title">Titel</label>
                    <input
                      id="wiz-title"
                      name="title"
                      type="text"
                      required
                      placeholder="Titel eingeben..."
                      mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                      value={resolvedTitle}
                    />
                    {fieldErrors?.title ? <span mix={inlineErrorStyle}>{fieldErrors.title}</span> : null}
                  </div>
                </>
              )}

              <div mix={table.actions}>
                {fullHourSlots.length > 0 ? (
                  <Button type="submit" tone="primary" mix={table.spacer}>
                    Anlegen
                  </Button>
                ) : null}
                <a href={buildBackUrl(resourceId, gridState)} mix={table.linkPlain}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Zurück
                  </Button>
                </a>
                <a href={buildCancelUrl(routes.appointmentsNew.index.href(), gridState.offset, gridState.sort, gridState.order, gridState.filter, gridState.period, gridState.status)} mix={[table.spacer, table.linkPlain]}>
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
