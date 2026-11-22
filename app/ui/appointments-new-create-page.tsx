import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'

import { buttonLink } from '../ui/theme/button.ts'
import type { ResourceOption, DayWithSlots } from '../data/appointments.ts'
import { frames, routes } from '../routes.ts'
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

const panelTitleStyle = css({
  margin: 0,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  outline: 'none',
})

// The resource list can be long, so cancellation must stay reachable at the
// top of the panel instead of only after every card.
const headerCancelStyle = css({
  marginLeft: 'auto',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '@media (max-width: 768px)': {
    minHeight: '44px',
    paddingLeft: theme.space.sm,
  },
  '&:hover': { color: theme.colors.text.primary },
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
          <h3
            id="appointments-new-panel-title"
            data-panel-heading
            tabIndex={-1}
            mix={panelTitleStyle}
          >
            Neuer Termin
          </h3>
          <a
            href={buildCancelUrl(base, offset, sort, order, filter, period, status)}
            data-rmx-target={frames.appointmentsNewContent}
            mix={headerCancelStyle}
          >
            Abbrechen
          </a>
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
              data-rmx-target={frames.appointmentsNewContent}
              mix={[
                table.linkPlain,
                buttonLink({ tone: 'secondary' }),
                css({
                  width: '100%',
                  '@media (max-width: 768px)': { minHeight: '44px' },
                }),
              ]}
            >
              Abbrechen
            </a>
          </div>
        </div>
      </div>
    )
  }
}
