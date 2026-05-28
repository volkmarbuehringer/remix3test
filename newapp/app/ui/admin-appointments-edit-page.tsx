import type { Handle } from 'remix/ui'
import type { AppointmentRow, ResourceOption, UserOption } from '../actions/admin-appointments-controller.tsx'
import { AdminAppointmentsForm } from './admin-appointments-form.tsx'

export interface AdminAppointmentsEditPageProps {
  row: AppointmentRow
  resources: ResourceOption[]
  users: UserOption[]
  offset: string
  sort: string
  order: string
  filter?: string
}

export function AdminAppointmentsEditPage(handle: Handle<AdminAppointmentsEditPageProps>) {
  return () => {
    let { row, resources, users, offset, sort, order, filter = '' } = handle.props
    return (
      <AdminAppointmentsForm
        mode="edit"
        row={row}
        resources={resources}
        users={users}
        gridState={{ offset, sort, order, filter: filter ?? '' }}
      />
    )
  }
}
