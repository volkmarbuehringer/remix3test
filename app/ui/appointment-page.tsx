import { css, Frame, type Handle } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'

import { Layout } from './layout.tsx'
import { AppointmentSidebar } from './appointment-sidebar.tsx'
import { AppointmentGrid } from './appointment-grid.browser.tsx'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import { frames, routes } from '../routes.ts'
import type { AppointOffering, Resource } from '../data/schema.ts'
import type { WeekAppointment } from '../data/appointments.ts'
import { parseDuring } from '../utils/during.ts'
import { getCspNonce } from '../middleware/security-headers.ts'

interface AppointmentPageProps {
  year: number
  week: number
  days: Array<{ dayName: string; date: number; dateStr: string }>
  appointments: WeekAppointment[]
  offerings: AppointOffering[]
  resources: Resource[]
  selectedResourceId: number
  csrfToken: string
  currentUserId: number
  isAdmin: boolean
  /** True when the request carries the appointment-content frame header. */
  isFrame: boolean
}

export function AppointmentPage(handle: Handle<AppointmentPageProps>) {
  return () => {
    let {
      year,
      week,
      days,
      appointments,
      offerings,
      resources,
      selectedResourceId,
      csrfToken,
      currentUserId,
      isAdmin,
      isFrame,
    } = handle.props
    let mondayMs = days[0]?.date ?? 0

    // Normalize offerings to a simpler shape for the client.
    // Skip any offering with an unparseable during range — a zero-duration
    // offering (0,0) would make the grid think no slots are bookable.
    let clientOfferings = offerings
      .map((o) => {
        let parsed = parseDuring(o.during)
        if (!parsed) {
          console.warn(
            `[appointment-page] Skipping corrupt offering ${o.id}: unparseable during="${o.during}"`,
          )
          return null
        }
        return { day: o.day, start_min: parsed.startMin, end_min: parsed.endMin }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)

    let appointmentHref = routes.appointment.index.href()
    let appointmentTypesHref = routes.appointment.types.index.href()
    let data = JSON.stringify({
      year,
      week,
      weekStart: mondayMs,
      days,
      appointments,
      offerings: clientOfferings,
      resources,
      selectedResourceId,
      csrfToken,
      currentUserId,
      isAdmin,
      appointmentHref,
      appointmentTypesHref,
    })

    // Canonical frame URL: the frame resolves this exact week/resource even
    // when the browser address bar still shows the bare /appointment path.
    let frameSrc = `${routes.appointment.index.href()}?year=${year}&week=${week}&resource_id=${selectedResourceId}`

    // Everything below the title changes with year/week/resource, so it all
    // lives inside the appointmentContent frame. The embedded JSON script must
    // travel with the fragment: the grid re-reads it after each frame swap.
    let content = (
      <>
        <script id="appointment-data" type="application/json" nonce={getCspNonce()}>
          {data}
        </script>
        <div mix={shellStyle}>
          <div data-sidebar-col="true" mix={sidebarColumnStyle}>
            <AppointmentSidebar
              year={year}
              week={week}
              weekStart={mondayMs}
              selectedResourceId={selectedResourceId}
              resources={resources}
            />
            <Frame
              name={frames.appointTypes}
              src={routes.appointment.types.index.href()}
              fallback={<div mix={appointTypesFallbackStyle}>Terminarten werden geladen…</div>}
            />
          </div>
          <div mix={gridColumnStyle}>
            <div mix={indicatorBarStyle}>
              <ConnectionIndicator url={routes.appointment.events.href()} reloadMode="window" />
            </div>
            <AppointmentGrid />
          </div>
        </div>
      </>
    )

    // Frame-fragment requests must not re-render the document shell (or a
    // nested appointmentContent frame): that is the frame-in-frame double load.
    if (isFrame) return content

    return (
      <Layout title="Termine">
        {/* Deliberately blocking (no fallback): the server resolves the frame's
            GET into the initial HTML, so first paint and no-JS show the grid.
            To keep this true, the frame GET must render HTML on every path. */}
        <Frame name={frames.appointmentContent} src={frameSrc} />
      </Layout>
    )
  }
}

/**
 * Slot content for the appointment-types panel frame. Without a fallback the
 * frame is blocking: a non-HTML frame response would fail the whole page render.
 */
const appointTypesFallbackStyle = css({
  padding: '1rem',
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

const shellStyle = css({
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
  gap: theme.space.lg,
  alignItems: 'start',
})

const sidebarColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  minWidth: 0,
  position: 'sticky',
  top: theme.space.lg,
})

const gridColumnStyle = css({
  minWidth: 0,
})

const indicatorBarStyle = css({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: theme.space.sm,
  padding: `${theme.space.xs} ${theme.space.xs} 0`,
  pointerEvents: 'none',
  background: theme.surface.lvl0,
  '& > *': {
    pointerEvents: 'auto',
  },
})
