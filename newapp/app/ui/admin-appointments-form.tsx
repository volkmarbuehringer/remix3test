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
import type { AppointmentRow, ResourceOption, UserOption } from '../actions/admin-appointments-controller.tsx'

// ── Shared constants ─────────────────────────────────────────────

/** 15-minute interval options (matching /appointment calendar granularity). */
const START_MIN_OPTIONS = Array.from({ length: 96 }, (_, i) => i * 15)
const END_MIN_OPTIONS = Array.from({ length: 96 }, (_, i) => (i + 1) * 15)

// ── Local styles (unique to this form) ────────────────────────────

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
  resources: ResourceOption[]
  users: UserOption[]
  /** Grid state for hidden inputs and cancel URL. */
  gridState: { offset: string; sort: string; order: string; filter: string }
  /** Row data (required in edit mode). */
  row?: AppointmentRow
  /** Default start minute for create mode (default: 480 = 08:00). */
  defaultStartMin?: number
  /** Default end minute for create mode (default: 1020 = 17:00). */
  defaultEndMin?: number
}

// ── Component ──

export function AdminAppointmentsForm(handle: Handle<AdminAppointmentsFormProps>) {
  return () => {
    let { mode, resources, users, gridState, row, defaultStartMin = 480, defaultEndMin = 1020 } = handle.props
    let isEdit = mode === 'edit'
    let { offset, sort, order, filter = '' } = gridState

    let startMin = isEdit && row ? Number(row.start_min) : defaultStartMin
    let endMin = isEdit && row ? Number(row.end_min) : defaultEndMin
    let dateValue = isEdit && row ? new Date(Number(row.date)).toISOString().split('T')[0] : ''

    let method = isEdit ? 'PUT' as const : 'POST' as const
    let action = isEdit && row ? `/admin/appointments/${row.id}` : '/admin/appointments'
    let panelTitle = isEdit ? 'Termin bearbeiten' : 'Neuer Termin'
    let submitLabel = isEdit ? 'Speichern' : 'Anlegen'
    let resourcePlaceholder = isEdit ? undefined : 'Ressource auswählen...'
    let userPlaceholder = isEdit ? undefined : 'Benutzer auswählen...'
    let titlePlaceholder = isEdit ? undefined : 'Titel eingeben...'

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method={method} action={action}>
          <GridStateHiddenInputs state={gridState} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              {isEdit && row ? <span mix={rowIdBadgeStyle}>#{row.id}</span> : null}
              <span mix={table.panelTitle}>{panelTitle}</span>
            </div>

            <div mix={table.panelBody}>
              {/* Resource dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-resource' : 'ac-resource'}>Ressource</label>
                <select
                  id={isEdit ? 'ae-resource' : 'ac-resource'}
                  name="resource_id"
                  required
                   mix={[input.base, input.focus, table.select]}
                >
                  {resourcePlaceholder ? (
                    <option value="" disabled selected>{resourcePlaceholder}</option>
                  ) : null}
                  {resources.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      selected={isEdit && row ? res.id === row.resource_id : undefined}
                    >
                      {res.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* User dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-user' : 'ac-user'}>Benutzer</label>
                <select
                  id={isEdit ? 'ae-user' : 'ac-user'}
                  name="user_id"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {userPlaceholder ? (
                    <option value="" disabled selected>{userPlaceholder}</option>
                  ) : null}
                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                      selected={isEdit && row ? user.id === row.user_id : undefined}
                    >
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-title' : 'ac-title'}>Titel</label>
                <input
                  id={isEdit ? 'ae-title' : 'ac-title'}
                  name="title"
                  type="text"
                  required
                  placeholder={titlePlaceholder}
                  mix={[input.base, input.focus]}
                  value={isEdit && row ? row.title : undefined}
                />
              </div>

              {/* Date input */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-date' : 'ac-date'}>Datum</label>
                <input
                  id={isEdit ? 'ae-date' : 'ac-date'}
                  name="date"
                  type="date"
                  required
                  mix={[input.base, input.focus]}
                  value={isEdit && row ? dateValue : undefined}
                />
              </div>

              {/* Start time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-start' : 'ac-start'}>Startzeit</label>
                <select
                  id={isEdit ? 'ae-start' : 'ac-start'}
                  name="start_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {START_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === startMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              {/* End time dropdown */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} htmlFor={isEdit ? 'ae-end' : 'ac-end'}>Endzeit</label>
                <select
                  id={isEdit ? 'ae-end' : 'ac-end'}
                  name="end_min"
                  required
                  mix={[input.base, input.focus, table.select]}
                >
                  {END_MIN_OPTIONS.map((min) => (
                    <option key={min} value={min} selected={min === endMin}>
                      {formatMinOption(min)}
                    </option>
                  ))}
                </select>
              </div>

              <div mix={table.actions}>
                <Button type="submit" tone="primary" mix={table.spacer}>
                  {submitLabel}
                </Button>
                <a href={buildCancelUrl('/admin/appointments', offset, sort, order, filter)} mix={[table.spacer, table.linkPlain]}>
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
