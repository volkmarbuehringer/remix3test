import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
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

// ── Component ──

export function AdminOfferingsCreatePage(handle: Handle<AdminOfferingsCreatePageProps>) {
  return () => {
    let { resources, offset = '', sort = '', order = '', filter = '' } = handle.props
    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/offerings">
          <GridStateHiddenInputs state={{ offset, sort, order, filter }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neues Angebot</span>
            </div>

            <div mix={table.panelBody}>
              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-resource">Ressource</label>
                <select
                  id="oc-resource"
                  name="resource_id"
                  required
                  mix={[input.base, input.focus, table.select]}
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
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-day">Tag</label>
                <input
                  id="oc-day"
                  name="day"
                  type="date"
                  required
                  mix={[input.base, input.focus]}
                />
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-start">Startzeit</label>
                <select
                  id="oc-start"
                  name="start_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === 480}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-end">Endzeit</label>
                <select
                  id="oc-end"
                  name="end_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === 1020}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  Anlegen
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
