import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

import button from '../ui/theme/button.ts'
import type { ResourceOption, DayWithSlots } from '../data/appointments.ts'
import { routes } from '../routes.ts'
import { ResourceCards } from './appointments-new-resource-cards.tsx'
import { Step2 } from './appointments-new-step2.tsx'
import { WizardSteps } from './appointments-new-steps.tsx'
import { table } from './mixins/admin-table.ts'
import { buildCancelUrl } from './mixins/admin-urls.ts'

const introStyle = css({
  margin: 0,
  marginBottom: theme.space.md,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

interface AppointmentsNewCreatePageProps {
  resources: ResourceOption[]
  offset?: string | undefined
  sort?: string | undefined
  order?: string | undefined
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
  step?: number | undefined
  wizardResourceId?: string | undefined
  wizardResourceName?: string | undefined
  wizardResourceDescription?: string | undefined
  weekStart?: number | undefined
  daysWithSlots?: DayWithSlots[] | undefined
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
    let base = routes.appointmentsNew.index.href()

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
      <div mix={table.panel}>
        <div mix={table.panelHeader}>
          <span mix={table.panelTitle}>Neuer Termin</span>
        </div>
        <div mix={table.panelBody}>
          <WizardSteps current={1} />
          <p mix={introStyle}>
            Wählen Sie eine Ressource aus, um verfügbare Tage und Uhrzeiten zu sehen.
          </p>
          <ResourceCards resources={resources} gridState={gridState} />
          <div mix={table.actions}>
            <a
              href={buildCancelUrl(base, offset, sort, order, filter, period, status)}
              mix={table.linkPlain}
            >
              <button type="button" mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}>
                Abbrechen
              </button>
            </a>
          </div>
        </div>
      </div>
    )
  }
}
