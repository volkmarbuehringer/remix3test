import { css, Frame, type Handle } from 'remix/ui'
import { theme } from 'remix/ui/theme'

import { Layout } from './layout.tsx'
import { AppointmentSidebar } from './appointment-sidebar.tsx'
import { AppointmentGrid } from './appointment-grid.tsx'
import { ConnectionIndicator } from '../assets/connection-indicator.tsx'
import { frames, routes } from '../routes.ts'
import type { AppointOffering, Appointment, Resource } from '../data/schema.ts'
import { parseDuring } from '../data/appointofferings.ts'
import { getCspNonce } from '../middleware/security-headers.ts'

function formatDateRange(mondayMs: number): string {
  let monday = new Date(mondayMs)
  let sunday = new Date(mondayMs + 6 * 86_400_000)
  let months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  let monStr = `${months[monday.getUTCMonth()]} ${monday.getUTCDate()}`
  let sunStr = `${months[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
  return `${monStr} – ${sunStr}`
}

interface AppointmentPageProps {
  year: number
  week: number
  days: Array<{ dayName: string; date: number; dateStr: string }>
  appointments: Appointment[]
  offerings: AppointOffering[]
  resources: Resource[]
  selectedResourceId: number
  csrfToken: string
  currentUserId: number
  isAdmin: boolean
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

    return (
      <Layout title="Termine">
        <script id="appointment-data" type="application/json" nonce={getCspNonce()}>
          {data}
        </script>
        <div mix={shellStyle}>
          <div data-sidebar-col="true" mix={sidebarColumnStyle}>
            <AppointmentSidebar />
            <Frame name={frames.appointTypes} src={routes.appointment.types.index.href()} />
          </div>
          <div mix={gridColumnStyle}>
            <div mix={indicatorBarStyle}>
              <ConnectionIndicator url={routes.appointment.events.href()} reloadMode="window" />
            </div>
            <AppointmentGrid />
          </div>
        </div>
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
