import type { Handle } from 'remix/ui'
import type { AppointmentRow, ResourceOption, UserOption } from '../actions/admin-appointments/controller.tsx'
import { AdminAppointmentsForm } from './admin-appointments-form.tsx'

export interface AdminAppointmentsEditPageProps {
  row: AppointmentRow
  resources: ResourceOption[]
  users: UserOption[]
  offset: string
  sort: string
  order: string
  filter?: string
  period?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

export function AdminAppointmentsEditPage(handle: Handle<AdminAppointmentsEditPageProps>) {
  return () => {
    let { row, resources, users, offset, sort, order, filter = '', period = '', formValues, fieldErrors, formError } = handle.props
    return (
      <AdminAppointmentsForm
        mode="edit"
        row={row}
        resources={resources}
        users={users}
        gridState={{ offset, sort, order, filter: filter ?? '', period }}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
