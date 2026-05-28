import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { adminRoutes as routes } from '../../routes.ts'

interface Activity {
  id: number
  userId: number
  action: string
  time: Date
}

interface RecentActivityFragmentProps {
  activities: Activity[]
}

const cardStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const titleStyle = css({
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: '0 0 1rem',
  color: theme.colors.text.primary,
})

const listStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const activityRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: theme.space.sm,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.subtle}`,
})

const activityInfoStyle = css({
  flex: 1,
  minWidth: 0,
})

const activityActionStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

const activityTimeStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  marginTop: '2px',
})

const detailBtnStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.action.primary.background,
  cursor: 'pointer',
  display: 'inline-block',
  padding: '4px 0',
  '&:hover': {
    textDecoration: 'underline',
  },
})

const nestedFrameContainer = css({
  marginTop: theme.space.sm,
  paddingLeft: theme.space.lg,
  borderLeft: `3px solid ${theme.colors.border.subtle}`,
})

function timeAgo(date: Date): string {
  let seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  let minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  let hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  let days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentActivityFragment(handle: Handle<RecentActivityFragmentProps>) {
  return () => {
    let { activities } = handle.props
    return (
    <div mix={cardStyle}>
      <h2 mix={titleStyle}>Recent Activity</h2>
      {activities.length === 0 ? (
        <p style={{ color: theme.colors.text.muted, fontSize: theme.fontSize.sm, margin: 0 }}>
          No recent activity.
        </p>
      ) : (
        <div mix={listStyle}>
          {activities.map((activity) => (
            <div key={activity.id}>
              <div mix={activityRowStyle}>
                <div mix={activityInfoStyle}>
                  <div mix={activityActionStyle}>{activity.action}</div>
                  <div mix={activityTimeStyle}>
                    by <strong>User #{activity.userId}</strong> &middot; {timeAgo(activity.time)}
                  </div>
                </div>
              </div>
              {/* Native <details>/<summary> disclosure widget — clickable,
                  toggles frame visibility, requires zero JS. An <a> would
                  trigger the navigation intercept and reload the top-level
                  Document frame with fragment HTML, causing
                  Node.insertBefore DOMException. */}
              <details>
                <summary mix={detailBtnStyle}>View details</summary>
                <div mix={nestedFrameContainer}>
                  <Frame
                    name={`user-detail-${activity.userId}`}
                    src={routes.admin.fragments.userDetail.href({ userId: String(activity.userId) })}
                    fallback={
                      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>
                        Loading user details…
                      </div>
                    }
                  />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
  }
}
