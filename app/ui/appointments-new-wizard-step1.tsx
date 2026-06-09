import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import type { GridState } from '../utils/grid-state.ts'
import type { ResourceOption } from '../actions/appointments-new/controller.tsx'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'

const inlineErrorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
  marginTop: theme.space.xs,
})

interface WizardStep1Props {
  resources: ResourceOption[]
  gridState: GridState
  fieldErrors?: Record<string, string>
  formValues?: Record<string, string>
}

export function WizardStep1(handle: Handle<WizardStep1Props>) {
  return () => {
    let { resources, gridState, fieldErrors, formValues } = handle.props
    let resolvedResourceId = formValues?.resource_id

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action={routes.appointmentsNew.index.href()} novalidate>
          <input type="hidden" name="_offset" value={gridState.offset} />
          <input type="hidden" name="_sort" value={gridState.sort} />
          <input type="hidden" name="_order" value={gridState.order} />
          <input type="hidden" name="_filter" value={gridState.filter} />
          <input type="hidden" name="_period" value={gridState.period ?? ''} />
          <input type="hidden" name="_status" value={gridState.status ?? ''} />
          <input type="hidden" name="step" value="1" />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neuer Termin – Schritt 1: Ressource wählen</span>
            </div>
            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="wiz-resource">Ressource</label>
                <select
                  id="wiz-resource"
                  name="resource_id"
                  required
                  mix={[input.base, input.focus, table.select, fieldErrors?.resource_id ? input.error : undefined]}
                >
                  <option value="" disabled selected={resolvedResourceId == null}>Ressource auswählen...</option>
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={resolvedResourceId != null && String(resolvedResourceId) === String(res.id)}
                    >
                      {res.description}
                    </option>
                  ))}
                </select>
                {fieldErrors?.resource_id ? <span mix={inlineErrorStyle}>{fieldErrors.resource_id}</span> : null}
              </div>
              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Weiter
                </Button>
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
