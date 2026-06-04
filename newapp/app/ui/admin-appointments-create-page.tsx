import type { Handle } from 'remix/ui'
import type { ResourceOption, UserOption } from '../actions/admin-appointments/controller.tsx'
import { AdminAppointmentsForm } from './admin-appointments-form.tsx'

export interface AdminAppointmentsCreatePageProps {
  resources: ResourceOption[]
  users: UserOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  defaultStartMin?: number
  defaultEndMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

export function AdminAppointmentsCreatePage(handle: Handle<AdminAppointmentsCreatePageProps>) {
  return () => {
    let { resources, users, offset = '', sort = '', order = '', filter = '', defaultStartMin, defaultEndMin, formValues, fieldErrors, formError } = handle.props
    return (
      <AdminAppointmentsForm
        mode="create"
        resources={resources}
        users={users}
        gridState={{ offset, sort, order, filter: filter ?? '' }}
        defaultStartMin={defaultStartMin}
        defaultEndMin={defaultEndMin}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
