import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'
import button, { buttonLink } from '../ui/theme/button.ts'
import { animateEntrance } from '@remix-run/ui/animation'
import { entrance } from '../utils/motion.ts'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { IntervalBounds } from './interval-bounds.browser.tsx'
import { PendingSubmitButton } from './pending-submit.browser.tsx'
import { FormErrorFocus } from './form-error-focus.browser.tsx'
import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
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
  padding: theme.space.xs + ' ' + theme.space.sm,
  marginBottom: theme.space.sm,
  background: theme.colors.action.danger.background + '15',
  border: '1px solid ' + theme.colors.action.danger.background,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
})

const rowIdBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: theme.space.xs + ' ' + theme.space.sm,
  background: theme.surface.lvl3,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
})

// ── Types ────────────────────────────────────────────────────────

interface AdminAppointmentsFormProps {
  /** 'create' for new appointment form, 'edit' for editing an existing one. */
  mode: 'create' | 'edit'
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  /** Grid state for hidden inputs and cancel URL. */
  gridState: GridState
  /** Row data (required in edit mode). */
  row?: AppointmentRow
  /** Default start minute for create mode (default: 480 = 08:00). */
  defaultStartMin?: number | undefined
  /** Default end minute for create mode (default: 1020 = 17:00). */
  defaultEndMin?: number | undefined
  /** Per-field validation errors (keyed by field name). */
  fieldErrors?: Record<string, string> | undefined
  /** Form-level error (displayed as banner). */
  formError?: string | undefined
  /** Submitted form values to preserve on validation failure. */
  formValues?: Record<string, string> | undefined
}

/** Normalizes a raw preserved id to a comparable string; '' means "not chosen". */
function asValue(raw: string | number | undefined | null): string {
  return raw == null ? '' : String(raw)
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

    // A cleared select submits '', which must select the placeholder again. Using
    // the raw value here previously kept the first resource visually selected
    // while the inline error still said "ist erforderlich.".
    let resourceValue = asValue(resolvedResourceId)
    let userValue = asValue(resolvedUserId)

    let method = isEdit ? ('PUT' as const) : ('POST' as const)
    let action =
      isEdit && row
        ? routes.verwaltung.appointments.update.href({ id: row.id })
        : routes.verwaltung.appointments.create.href()
    let panelTitle = isEdit ? 'Termin bearbeiten' : 'Neuer Termin'
    let submitLabel = isEdit ? 'Speichern' : 'Anlegen'
    let titlePlaceholder = isEdit ? undefined : 'Titel eingeben...'

    let ids = {
      resource: isEdit ? 'ae-resource' : 'ac-resource',
      user: isEdit ? 'ae-user' : 'ac-user',
      title: isEdit ? 'ae-title' : 'ac-title',
      date: isEdit ? 'ae-date' : 'ac-date',
      start: isEdit ? 'ae-start' : 'ac-start',
      end: isEdit ? 'ae-end' : 'ac-end',
    }

    return (
      <div
        mix={animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))}
      >
        <RestfulForm
          method={method}
          action={action}
          novalidate
          data-rmx-target={getSelfFrameTarget()}
        >
          <GridStateHiddenInputs state={gridState} />
          <IntervalBounds startId={ids.start} endId={ids.end} />
          <FormErrorFocus />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              {isEdit && row ? <span mix={rowIdBadgeStyle}>#{row.id}</span> : null}
              <span mix={table.panelTitle}>{panelTitle}</span>
            </div>

            <div mix={table.panelBody}>
              {formError ? (
                <div mix={formErrorBanner} role="alert">
                  {formError}
                </div>
              ) : null}

              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.resource}>
                  Ressource
                </label>
                <select
                  id={ids.resource}
                  name="resource_id"
                  required
                  aria-invalid={fieldErrors?.resource_id ? 'true' : undefined}
                  aria-describedby={fieldErrors?.resource_id ? ids.resource + '-error' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.resource_id ? input.error : undefined,
                  ]}
                >
                  <option value="" disabled selected={resourceValue === ''}>
                    Ressource auswählen...
                  </option>
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={resourceValue !== '' && resourceValue === String(res.id)}
                    >
                      {res.name}
                    </option>
                  ))}
                </select>
                {fieldErrors?.resource_id ? (
                  <span id={ids.resource + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.resource_id}
                  </span>
                ) : null}
              </div>

              {/* User dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.user}>
                  Benutzer
                </label>
                <select
                  id={ids.user}
                  name="user_id"
                  required
                  aria-invalid={fieldErrors?.user_id ? 'true' : undefined}
                  aria-describedby={fieldErrors?.user_id ? ids.user + '-error' : undefined}
                  mix={[
                    input.base,
                    input.focus,
                    table.select,
                    fieldErrors?.user_id ? input.error : undefined,
                  ]}
                >
                  <option value="" disabled selected={userValue === ''}>
                    Benutzer auswählen...
                  </option>
                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                      selected={userValue !== '' && userValue === String(user.id)}
                    >
                      {user.name}
                    </option>
                  ))}
                </select>
                {fieldErrors?.user_id ? (
                  <span id={ids.user + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.user_id}
                  </span>
                ) : null}
              </div>

              {/* Title input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.title}>
                  Titel
                </label>
                <input
                  id={ids.title}
                  name="title"
                  type="text"
                  required
                  placeholder={titlePlaceholder}
                  aria-invalid={fieldErrors?.title ? 'true' : undefined}
                  aria-describedby={fieldErrors?.title ? ids.title + '-error' : undefined}
                  mix={[input.base, input.focus, fieldErrors?.title ? input.error : undefined]}
                  value={resolvedTitle}
                />
                {fieldErrors?.title ? (
                  <span id={ids.title + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.title}
                  </span>
                ) : null}
              </div>

              {/* Date input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.date}>
                  Datum
                </label>
                <input
                  id={ids.date}
                  name="date"
                  type="date"
                  required
                  aria-invalid={fieldErrors?.date ? 'true' : undefined}
                  aria-describedby={fieldErrors?.date ? ids.date + '-error' : undefined}
                  mix={[input.base, input.focus, fieldErrors?.date ? input.error : undefined]}
                  value={resolvedDate}
                />
                {fieldErrors?.date ? (
                  <span id={ids.date + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.date}
                  </span>
                ) : null}
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.start}>
                  Startzeit
                </label>
                <select
                  id={ids.start}
                  name="start_min"
                  required
                  aria-invalid={fieldErrors?.start_min ? 'true' : undefined}
                  aria-describedby={fieldErrors?.start_min ? ids.start + '-error' : undefined}
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
                  <span id={ids.start + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.start_min}
                  </span>
                ) : null}
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={ids.end}>
                  Endzeit
                </label>
                <select
                  id={ids.end}
                  name="end_min"
                  required
                  aria-invalid={fieldErrors?.end_min ? 'true' : undefined}
                  aria-describedby={fieldErrors?.end_min ? ids.end + '-error' : undefined}
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
                  <span id={ids.end + '-error'} role="alert" mix={inlineErrorStyle}>
                    {fieldErrors.end_min}
                  </span>
                ) : null}
              </div>

              <div mix={table.actions}>
                <PendingSubmitButton>{submitLabel}</PendingSubmitButton>
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
                  mix={[
                    table.spacer,
                    table.linkPlain,
                    buttonLink({ tone: 'secondary' }),
                    css({ width: '100%' }),
                  ]}
                >
                  Abbrechen
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
