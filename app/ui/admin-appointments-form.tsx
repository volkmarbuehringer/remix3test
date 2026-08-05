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
import type { GridState } from '../utils/grid-state.ts'
import type {
  AppointmentRow,
  AppointmentResourceOption,
  AppointmentUserOption,
} from '../data/appointments.ts'

// ── Shared constants ─────────────────────────────────────────────

/** 15-minute interval options (matching /appointment calendar granularity). */
const START_MIN_OPTIONS = generateMinOptions(96, 15)
const END_MIN_OPTIONS = generateMinOptions(96, 15, 1)

// ── Local styles (unique to this form) ────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────

export interface AdminAppointmentsFormProps {
  /** 'create' for new appointment form, 'edit' for editing an existing one. */
  mode: 'create' | 'edit'
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  /** Grid state for hidden inputs and cancel URL. */
  gridState: GridState
  /** Row data (required in edit mode). */
  row?: AppointmentRow
  /** Default start minute for create mode (default: 480 = 08:00). */
  defaultStartMin?: number
  /** Default end minute for create mode (default: 1020 = 17:00). */
  defaultEndMin?: number
  /** Per-field validation errors (keyed by field name). */
  fieldErrors?: Record<string, string>
  /** Form-level error (displayed as banner). */
  formError?: string
  /** Submitted form values to preserve on validation failure. */
  formValues?: Record<string, string>
}

// ── Component ──

export function AdminAppointmentsForm(handle: Handle<AdminAppointmentsFormProps>) {
  return () => {
    let {
      mode,
      resources,
      users,
      gridState,
      row,
      defaultStartMin = 480,
      defaultEndMin = 1020,
      fieldErrors,
      formError,
      formValues,
    } = handle.props
    let isEdit = mode === 'edit'
    let { offset, sort, order, filter = '', period = '', status = '' } = gridState

    // Value priority: formValues (submitted on error) > row (from DB) > defaults
    let resolvedResourceId =
      formValues?.resource_id ?? (isEdit && row ? row.resource_id : undefined)
    let resolvedUserId = formValues?.user_id ?? (isEdit && row ? row.user_id : undefined)
    let resolvedTitle = formValues?.title ?? (isEdit && row ? row.title : undefined)
    let resolvedDate =
      formValues?.date ??
      (isEdit && row ? new Date(Number(row.date)).toISOString().split('T')[0] : '')
    let resolvedStartMin =
      formValues?.start_min !== undefined
        ? Number(formValues.start_min)
        : isEdit && row
          ? Number(row.start_min)
          : defaultStartMin
    let resolvedEndMin =
      formValues?.end_min !== undefined
        ? Number(formValues.end_min)
        : isEdit && row
          ? Number(row.end_min)
          : defaultEndMin

    let method = isEdit ? ('PUT' as const) : ('POST' as const)
    let action =
      isEdit && row
        ? routes.verwaltung.appointments.update.href({ id: row.id })
        : routes.verwaltung.appointments.create.href()
    let panelTitle = isEdit ? 'Termin bearbeiten' : 'Neuer Termin'
    let submitLabel = isEdit ? 'Speichern' : 'Anlegen'
    let resourcePlaceholder = isEdit ? undefined : 'Ressource auswählen...'
    let userPlaceholder = isEdit ? undefined : 'Benutzer auswählen...'
    let titlePlaceholder = isEdit ? undefined : 'Titel eingeben...'

    return (
      <div mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}>
        <RestfulForm method={method} action={action} novalidate>
          <GridStateHiddenInputs state={gridState} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              {isEdit && row ? <span mix={rowIdBadgeStyle}>#{row.id}</span> : null}
              <span mix={table.panelTitle}>{panelTitle}</span>
            </div>

            <div mix={table.panelBody}>
              {formError ? <div mix={formErrorBanner}>{formError}</div> : null}

              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-resource' : 'ac-resource'}>
                  Ressource
                </label>
                <select
                  id={isEdit ? 'ae-resource' : 'ac-resource'}
                  name="resource_id"
                  required
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.resource_id ? input.error : undefined,
                  ]}
                >
                  {resourcePlaceholder ? (
                    <option value="" disabled selected={resolvedResourceId == null}>
                      {resourcePlaceholder}
                    </option>
                  ) : null}
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={
                        resolvedResourceId != null && String(resolvedResourceId) === String(res.id)
                      }
                    >
                      {res.name}
                    </option>
                  ))}
                </select>
                {fieldErrors?.resource_id ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.resource_id}</span>
                ) : null}
              </div>

              {/* User dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-user' : 'ac-user'}>
                  Benutzer
                </label>
                <select
                  id={isEdit ? 'ae-user' : 'ac-user'}
                  name="user_id"
                  required
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.user_id ? input.error : undefined,
                  ]}
                >
                  {userPlaceholder ? (
                    <option value="" disabled selected={resolvedUserId == null}>
                      {userPlaceholder}
                    </option>
                  ) : null}
                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                      selected={
                        resolvedUserId != null && String(resolvedUserId) === String(user.id)
                      }
                    >
                      {user.name}
                    </option>
                  ))}
                </select>
                {fieldErrors?.user_id ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.user_id}</span>
                ) : null}
              </div>

              {/* Title input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-title' : 'ac-title'}>
                  Titel
                </label>
                <input
                  id={isEdit ? 'ae-title' : 'ac-title'}
                  name="title"
                  type="text"
                  required
                  placeholder={titlePlaceholder}
                  mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                  value={resolvedTitle}
                />
                {fieldErrors?.title ? (
                  <span mix={inlineErrorStyle}>{fieldErrors.title}</span>
                ) : null}
              </div>

              {/* Date input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-date' : 'ac-date'}>
                  Datum
                </label>
                <input
                  id={isEdit ? 'ae-date' : 'ac-date'}
                  name="date"
                  type="date"
                  required
                  mix={[input.base, input.focus, fieldErrors?.date ? input.error : undefined]}
                  value={resolvedDate}
                />
                {fieldErrors?.date ? <span mix={inlineErrorStyle}>{fieldErrors.date}</span> : null}
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-start' : 'ac-start'}>
                  Startzeit
                </label>
                <select
                  id={isEdit ? 'ae-start' : 'ac-start'}
                  name="start_min"
                  required
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.start_min ? input.error : undefined,
                  ]}
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
                <label mix={table.label} htmlFor={isEdit ? 'ae-end' : 'ac-end'}>
                  Endzeit
                </label>
                <select
                  id={isEdit ? 'ae-end' : 'ac-end'}
                  name="end_min"
                  required
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.end_min ? input.error : undefined,
                  ]}
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
                  {submitLabel}
                </button>
                <a
                  href={buildCancelUrl(
                    routes.verwaltung.appointments.index.href(),
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
