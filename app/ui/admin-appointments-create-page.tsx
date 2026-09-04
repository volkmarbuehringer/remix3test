import type { Handle } from 'remix/ui'
import type { AppointmentResourceOption, AppointmentUserOption } from '../data/appointments.ts'
import { AdminAppointmentsForm } from './admin-appointments-form.tsx'

export interface AdminAppointmentsCreatePageProps {
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
  defaultStartMin?: number | undefined
  defaultEndMin?: number | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

export function AdminAppointmentsCreatePage(handle: Handle<AdminAppointmentsCreatePageProps>) {
  return () => {
    let {
      resources,
      users,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      period = '',
      status = '',
      defaultStartMin,
      defaultEndMin,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    return (
      <AdminAppointmentsForm
        mode="create"
        resources={resources}
        users={users}
        gridState={{ offset, sort, order, filter: filter ?? '', period, status }}
        defaultStartMin={defaultStartMin}
        defaultEndMin={defaultEndMin}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
