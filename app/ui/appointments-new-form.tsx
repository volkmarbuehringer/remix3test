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
import type { GridState } from '../utils/grid-state.ts'
import type { AppointmentsNewRow, ResourceOption } from '../actions/appointments-new/controller.tsx'

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

const BASE = '/appointments/new'

export interface AppointmentsNewFormProps {
  mode: 'create' | 'edit'
  resources: ResourceOption[]
  gridState: GridState
  row?: AppointmentsNewRow
  defaultStartMin?: number
  fieldErrors?: Record<string, string>
  formError?: string
  formValues?: Record<string, string>
  fullHourSlots?: number[]
}

export function AppointmentsNewForm(handle: Handle<AppointmentsNewFormProps>) {
  return () => {
    let { mode, resources, gridState, row, defaultStartMin = 480, fieldErrors, formError, formValues, fullHourSlots } = handle.props
    let isEdit = mode === 'edit'
    let { offset, sort, order, filter = '', period = '', status = '' } = gridState

    let resolvedResourceId = formValues?.resource_id ?? (isEdit && row ? row.resource_id : undefined)
    let resolvedTitle = formValues?.title ?? (isEdit && row ? row.title : undefined)
    let resolvedDate = formValues?.date ?? (isEdit && row ? new Date(Number(row.date)).toISOString().split('T')[0] : '')
    let resolvedStartMin = formValues?.start_min !== undefined ? Number(formValues.start_min) : (isEdit && row ? Number(row.start_min) : defaultStartMin)

    let timeOptions = fullHourSlots ?? (isEdit && row ? [Number(row.start_min)] : [])

    let method = isEdit ? 'PUT' as const : 'POST' as const
    let action = isEdit && row ? `${BASE}/${row.id}` : BASE
    let panelTitle = isEdit ? 'Termin bearbeiten' : 'Neuer Termin'
    let submitLabel = isEdit ? 'Speichern' : 'Anlegen'

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method={method} action={action} novalidate>
          <GridStateHiddenInputs state={gridState} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              {isEdit && row ? <span mix={rowIdBadgeStyle}>#{row.id}</span> : null}
              <span mix={table.panelTitle}>{panelTitle}</span>
            </div>

            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'an-resource' : 'ac-resource'}>Ressource</label>
                <select
                  id={isEdit ? 'an-resource' : 'ac-resource'}
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

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'an-title' : 'ac-title'}>Titel</label>
                <input
                  id={isEdit ? 'an-title' : 'ac-title'}
                  name="title"
                  type="text"
                  required
                  placeholder="Titel eingeben..."
                  mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                  value={resolvedTitle}
                />
                {fieldErrors?.title ? <span mix={inlineErrorStyle}>{fieldErrors.title}</span> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'an-date' : 'ac-date'}>Datum</label>
                <input
                  id={isEdit ? 'an-date' : 'ac-date'}
                  name="date"
                  type="date"
                  required
                  mix={[input.base, input.focus, fieldErrors?.date ? input.error : undefined]}
                  value={resolvedDate}
                />
                {fieldErrors?.date ? <span mix={inlineErrorStyle}>{fieldErrors.date}</span> : null}
              </div>

              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'an-start' : 'ac-start'}>Startzeit</label>
                <select
                  id={isEdit ? 'an-start' : 'ac-start'}
                  name="start_min"
                  required
                  mix={[input.base, input.focus, table.select, fieldErrors?.start_min ? input.error : undefined]}
                >
                  {timeOptions.map((min) => (
                    <option key={min} value={min} selected={min === resolvedStartMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
                {fieldErrors?.start_min ? <span mix={inlineErrorStyle}>{fieldErrors.start_min}</span> : null}
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  {submitLabel}
                </Button>
                <a href={buildCancelUrl(BASE, offset, sort, order, filter, period, status)} mix={[table.spacer, table.linkPlain]}>
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
