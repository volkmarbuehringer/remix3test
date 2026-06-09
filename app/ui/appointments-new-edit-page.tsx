import type { Handle } from 'remix/ui'
import type { AppointmentsNewRow, ResourceOption } from '../actions/appointments-new/controller.tsx'
import { AppointmentsNewForm } from './appointments-new-form.tsx'

export interface AppointmentsNewEditPageProps {
  row: AppointmentsNewRow
  resources: ResourceOption[]
  offset: string
  sort: string
  order: string
  filter?: string
  period?: string
  status?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  fullHourSlots?: number[]
}

export function AppointmentsNewEditPage(handle: Handle<AppointmentsNewEditPageProps>) {
  return () => {
    let { row, resources, offset, sort, order, filter = '', period = '', status = '', formValues, fieldErrors, formError, fullHourSlots } = handle.props
    return (
      <AppointmentsNewForm
        mode="edit"
        row={row}
        resources={resources}
        gridState={{ offset, sort, order, filter: filter ?? '', period, status }}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
        fullHourSlots={fullHourSlots}
      />
    )
  }
}
