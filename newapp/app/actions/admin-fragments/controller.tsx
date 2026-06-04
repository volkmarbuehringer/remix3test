import { createController } from 'remix/router'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { StatsFragment } from '../../ui/admin-fragments/stats-fragment.tsx'
import { RecentActivityFragment } from '../../ui/admin-fragments/recent-activity-fragment.tsx'
import { UserDetailFragment } from '../../ui/admin-fragments/user-detail-fragment.tsx'

/**
 * Controller for admin fragment endpoints used by nested frames.
 * Each action renders a fragment without Layout/Document wrapper.
 */
export default createController<typeof routes.admin.fragments, AppContext>(
  routes.admin.fragments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async stats(context) {
        // Brief delay so the frame fallback is visible
        await delay(50)

        // Gather some server-time stats
        let now = new Date()
        let uptimeSeconds = Math.floor(process.uptime())
        let hours = Math.floor(uptimeSeconds / 3600)
        let minutes = Math.floor((uptimeSeconds % 3600) / 60)

        return context.render(
          <StatsFragment
            serverTime={now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            serverDate={now.toLocaleDateString('de-DE')}
            uptime={`${hours}h ${minutes}m`}
            nodeVersion={process.version}
          />,
          fragmentResponseInit(),
        )
      },

      async recentActivity(context) {
        // Brief delay so the frame fallback is visible
        await delay(100)

        let now = new Date()

        // Generate some fake recent activity entries with user IDs
        let activities = [
          { id: 1, userId: 101, action: 'Created a new chat conversation', time: new Date(now.getTime() - 30000) },
          { id: 2, userId: 102, action: 'Deleted a workflow', time: new Date(now.getTime() - 120000) },
          { id: 3, userId: 103, action: 'Updated AI agent configuration', time: new Date(now.getTime() - 300000) },
          { id: 4, userId: 101, action: 'Exported chat log', time: new Date(now.getTime() - 600000) },
          { id: 5, userId: 104, action: 'Modified admin settings', time: new Date(now.getTime() - 900000) },
          { id: 6, userId: 102, action: 'Ran a new agent process', time: new Date(now.getTime() - 1800000) },
        ]

        return context.render(
          <RecentActivityFragment activities={activities} />,
          fragmentResponseInit(),
        )
      },

      async userDetail(context) {
        // Quick delay for the nested detail frame
        await delay(30)

        let userId = Number(context.params.userId)
        let userNames: Record<number, string> = {
          101: 'Alice Johnson',
          102: 'Bob Smith',
          103: 'Carol Williams',
          104: 'David Brown',
        }
        let userRoles: Record<number, string> = {
          101: 'Admin',
          102: 'Editor',
          103: 'Viewer',
          104: 'Viewer',
        }

        return context.render(
          <UserDetailFragment
            userId={userId}
            name={userNames[userId] ?? `User #${userId}`}
            role={userRoles[userId] ?? 'Unknown'}
          />,
          fragmentResponseInit(),
        )
      },
    },
  },
)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
