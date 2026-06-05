import type { Handle } from 'remix/ui'
import type { ResourceOption } from '../actions/appointments-new/controller.tsx'
import { AppointmentsNewForm } from './appointments-new-form.tsx'

export interface AppointmentsNewCreatePageProps {
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  period?: string
  defaultStartMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

export function AppointmentsNewCreatePage(handle: Handle<AppointmentsNewCreatePageProps>) {
  return () => {
    let { resources, offset = '', sort = '', order = '', filter = '', period = '', defaultStartMin, formValues, fieldErrors, formError } = handle.props
    return (
      <AppointmentsNewForm
        mode="create"
        resources={resources}
        gridState={{ offset, sort, order, filter: filter ?? '', period }}
        defaultStartMin={defaultStartMin}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
