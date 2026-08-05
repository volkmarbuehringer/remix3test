import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import button from '../ui/theme/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { routes } from '../routes.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'
import { formatMinOption, generateMinOptions } from '../utils/date-utils.ts'
import type { OfferingsResourceOption } from '../data/offerings-queries.ts'

interface AdminOfferingsCreatePageProps {
  resources: OfferingsResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  period?: string
  status?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

// Hourly interval options
const START_MIN_OPTIONS = generateMinOptions(24, 60)
const END_MIN_OPTIONS = generateMinOptions(24, 60, 1)

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

export function AdminOfferingsCreatePage(handle: Handle<AdminOfferingsCreatePageProps>) {
  return () => {
    let {
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      period = '',
      status = '',
      formValues,
      fieldErrors,
      formError,
    } = handle.props

    let resolvedResourceId = formValues?.resource_id ?? ''
    let resolvedDay = formValues?.day ?? ''
    let resolvedStartMin = formValues?.start_min ? Number(formValues.start_min) : 480
    let resolvedEndMin = formValues?.end_min ? Number(formValues.end_min) : 1020

    return (
      <div mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}>
        <RestfulForm method="POST" action={routes.verwaltung.offerings.create.href()} novalidate>
          <GridStateHiddenInputs state={{ offset, sort, order, filter, period, status }} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Neues Angebot</span>
            </div>

            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-resource">
                  Ressource
                </label>
                <select
                  id="oc-resource"
                  name="resource_id"
                  required
                  mix={
                    fieldErrors?.resource_id
                      ? [input.base, input.error, input.focus, table.select]
                      : [input.base, input.focus, table.select]
                  }
                >
                  <option value="" disabled selected={!resolvedResourceId}>
                    Ressource auswählen...
                  </option>
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={String(resolvedResourceId) === String(res.id)}
                    >
                      {res.name}
                    </option>
                  ))}
                </select>
                {fieldErrors?.resource_id ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.resource_id}</span>
                ) : null}
              </div>

              {/* Date input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-day">
                  Tag
                </label>
                <input
                  id="oc-day"
                  name="day"
                  type="date"
                  required
                  mix={
                    fieldErrors?.day
                      ? [input.base, input.error, input.focus]
                      : [input.base, input.focus]
                  }
                  value={resolvedDay}
                />
                {fieldErrors?.day ? <span mix={inlineErrorStyle}>{fieldErrors.day}</span> : null}
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-start">
                  Startzeit
                </label>
                <select
                  id="oc-start"
                  name="start_min"
                  required
                  mix={
                    fieldErrors?.start_min
                      ? [input.base, input.error, input.focus, table.select]
                      : [input.base, input.focus, table.select]
                  }
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === resolvedStartMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
                {fieldErrors?.start_min ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.start_min}</span>
                ) : null}
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor="oc-end">
                  Endzeit
                </label>
                <select
                  id="oc-end"
                  name="end_min"
                  required
                  mix={
                    fieldErrors?.end_min
                      ? [input.base, input.error, input.focus, table.select]
                      : [input.base, input.focus, table.select]
                  }
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === resolvedEndMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
                {fieldErrors?.end_min ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.end_min}</span>
                ) : null}
              </div>

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Anlegen
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.offerings.index.href(),
                    offset,
                    sort,
                    order,
                    filter,
                    period,
                    status,
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
