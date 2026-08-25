import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

import type { ResourceOption, DayWithSlots } from '../data/appointments.ts'
import { ResourceCards } from './appointments-new-resource-cards.tsx'
import { Step2 } from './appointments-new-step2.tsx'

const titleStyle = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  marginBottom: theme.space.md,
})

export interface AppointmentsNewCreatePageProps {
  resources: ResourceOption[]
  offset?: string
  sort?: string
  order?: string
  filter?: string
  period?: string
  status?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  wizardResourceName?: string
  wizardResourceDescription?: string
  weekStart?: number
  daysWithSlots?: DayWithSlots[]
}

export function AppointmentsNewCreatePage(handle: Handle<AppointmentsNewCreatePageProps>) {
  return () => {
    let {
      resources,
      offset = '',
      sort = '',
      order = '',
      filter = '',
      period = '',
      status = '',
      formValues,
      fieldErrors,
      formError,
      step,
      wizardResourceId,
      wizardResourceName,
      wizardResourceDescription,
      weekStart,
      daysWithSlots,
    } = handle.props

    let gridState = { offset, sort, order, filter: filter ?? '', period: period ?? '', status }

    // Step 2: combined day + time + title selection
    if (step === 2 && wizardResourceId && weekStart && daysWithSlots) {
      return (
        <Step2
          resourceId={wizardResourceId}
          resourceName={wizardResourceName}
          resourceDescription={wizardResourceDescription}
          weekStart={weekStart}
          daysWithSlots={daysWithSlots}
          gridState={gridState}
          formValues={formValues}
          fieldErrors={fieldErrors}
          formError={formError}
        />
      )
    }

    // Step 1 (or fallback): resource selection cards
    return (
      <div>
        <div mix={titleStyle}>Neuer Termin – Schritt 1 von 2: Ressource wählen</div>
        <ResourceCards resources={resources} gridState={gridState} />
      </div>
    )
  }
}
