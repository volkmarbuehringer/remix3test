import type { Handle } from 'remix/ui'
import type {
  AppointmentRow,
  AppointmentResourceOption,
  AppointmentUserOption,
} from '../data/appointments.ts'
import { AdminAppointmentsForm } from './admin-appointments-form.tsx'

export interface AdminAppointmentsEditPageProps {
  row: AppointmentRow
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  offset: string
  sort: string
  order: string
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

export function AdminAppointmentsEditPage(handle: Handle<AdminAppointmentsEditPageProps>) {
  return () => {
    let {
      row,
      resources,
      users,
      offset,
      sort,
      order,
      filter = '',
      period = '',
      status = '',
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    return (
      <AdminAppointmentsForm
        mode="edit"
        row={row}
        resources={resources}
        users={users}
        gridState={{ offset, sort, order, filter: filter ?? '', period, status }}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
