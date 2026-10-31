import { css, Frame, type Handle } from 'remix/component'
import { theme } from '../ui/theme/theme.ts'

import { Layout } from './layout.tsx'
import { AppointmentSidebar } from './appointment-sidebar.tsx'
import { AppointmentGrid } from './appointment-grid.browser.tsx'
import { FrameFallback } from './frame-fallback.browser.tsx'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import { frames, routes } from '../routes.ts'
import type { AppointOffering, Resource } from '../data/schema.ts'
import type { WeekAppointment } from '../data/appointments.ts'
import type { AppData } from './appointment-grid-types.ts'
import { parseDuring } from '../utils/during.ts'

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
    // Serializable source for the server-rendered grid (guide 05: pass the
    // hydrated component the data it needs instead of making it read the page).
    // This is the only copy: the client entry serializes it once into rmx-data.
    let serverNow = new Date()
    let gridData: AppData = {
      days,
      // Occupancy rows deliberately carry `user_id: undefined`; the grid only
      // lays rows out (same cast as readData()).
      appointments: appointments as unknown as AppData['appointments'],
      offerings: clientOfferings,
      csrfToken,
      weekStart: mondayMs,
      // Server UTC day for the first render; the client corrects the highlight
      // for its local day after hydration (no server/client diff).
      todayMs: Date.UTC(
        serverNow.getUTCFullYear(),
        serverNow.getUTCMonth(),
        serverNow.getUTCDate(),
      ),
      currentUserId,
      selectedResourceId,
      isAdmin,
      appointmentHref,
      appointmentTypesHref,
    }

    // Canonical frame URL: the frame resolves this exact week/resource even
    // when the browser address bar still shows the bare /appointment path.
    let frameSrc = `${routes.appointment.index.href()}?year=${year}&week=${week}&resource_id=${selectedResourceId}`

    // Everything below the title changes with year/week/resource, so it all
    // lives inside the appointmentContent frame. The grid data travels as the
    // client entry's props, so the frame fragment carries it without a second
    // JSON copy.
    let content = (
      <>
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
              fallback={
                <FrameFallback label="Terminarten werden geladen…" name={frames.appointTypes} />
              }
            />
          </div>
          <div mix={gridColumnStyle}>
            <div mix={indicatorBarStyle}>
              {/* Invalidate reloads this page's content frame (sidebar + grid), not
                  the whole document, so client state and scroll survive. */}
              <ConnectionIndicator url={routes.appointment.events.href()} />
            </div>
            <AppointmentGrid data={gridData} />
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
            The grid renders its layout from server-provided props, so this
            holds only as long as the frame GET renders HTML on every path. */}
        <Frame name={frames.appointmentContent} src={frameSrc} />
      </Layout>
    )
  }
}

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
