import type { Handle } from 'remix/ui'
import type { ResourceOption } from '../actions/appointments-new/controller.tsx'
import { AppointmentsNewForm } from './appointments-new-form.tsx'
import { WizardStep1 } from './appointments-new-wizard-step1.tsx'
import { WizardStep2 } from './appointments-new-wizard-step2.tsx'
import { WizardStep3 } from './appointments-new-wizard-step3.tsx'

export interface AppointmentsNewCreatePageProps {
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  period?: string
  status?: string
  defaultStartMin?: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  wizardDay?: number
  daysWithOfferings?: { day: number; ranges: { startMin: number; endMin: number }[] }[]
  fullHourSlots?: number[]
}

export function AppointmentsNewCreatePage(handle: Handle<AppointmentsNewCreatePageProps>) {
  return () => {
    let { resources, offset = '', sort = '', order = '', filter = '', period = '', status = '', defaultStartMin, formValues, fieldErrors, formError, step, wizardResourceId, wizardDay, daysWithOfferings, fullHourSlots } = handle.props

    let gridState = { offset, sort, order, filter: filter ?? '', period: period ?? '', status }

    if (step === 2 && wizardResourceId && daysWithOfferings) {
      return (
        <WizardStep2
          resourceId={wizardResourceId}
          daysWithOfferings={daysWithOfferings}
          gridState={gridState}
          fieldErrors={fieldErrors}
        />
      )
    }

    if (step === 3 && wizardResourceId && wizardDay) {
      return (
        <WizardStep3
          resourceId={wizardResourceId}
          day={wizardDay}
          fullHourSlots={fullHourSlots ?? []}
          gridState={gridState}
          formValues={formValues}
          fieldErrors={fieldErrors}
          formError={formError}
        />
      )
    }

    // Step 1 (or fallback): show resource selection
    if (step === 1 || !step) {
      return (
        <WizardStep1
          resources={resources}
          gridState={gridState}
          fieldErrors={fieldErrors}
          formValues={formValues}
        />
      )
    }

    return (
      <AppointmentsNewForm
        mode="create"
        resources={resources}
        gridState={gridState}
        defaultStartMin={defaultStartMin}
        formValues={formValues}
        fieldErrors={fieldErrors}
        formError={formError}
      />
    )
  }
}
