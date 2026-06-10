import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from '../../lib/theme.ts'
import { routes } from '../../routes.ts'

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
  if (seconds < 60) return 'gerade eben'
  let minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `vor ${minutes} Min.`
  let hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  let days = Math.floor(hours / 24)
  return `vor ${days} Tagen`
}

export function RecentActivityFragment(handle: Handle<RecentActivityFragmentProps>) {
  return () => {
    let { activities } = handle.props
    return (
    <div mix={cardStyle}>
      <h2 mix={titleStyle}>Letzte Aktivitäten</h2>
      {activities.length === 0 ? (
        <p mix={css({ color: theme.colors.text.muted, fontSize: theme.fontSize.sm, margin: 0 })}>
          Keine aktuellen Aktivitäten.
        </p>
      ) : (
        <div mix={listStyle}>
          {activities.map((activity) => (
            <div key={activity.id}>
              <div mix={activityRowStyle}>
                <div mix={activityInfoStyle}>
                  <div mix={activityActionStyle}>{activity.action}</div>
                  <div mix={activityTimeStyle}>
                    von <strong>Benutzer #{activity.userId}</strong> &middot; {timeAgo(activity.time)}
                  </div>
                </div>
              </div>
              {/* Native <details>/<summary> disclosure widget — clickable,
                  toggles frame visibility, requires zero JS. An <a> would
                  trigger the navigation intercept and reload the top-level
                  Document frame with fragment HTML, causing
                  Node.insertBefore DOMException. */}
              <details>
                <summary mix={detailBtnStyle}>Details anzeigen</summary>
                <div mix={nestedFrameContainer}>
                  <Frame
                    name={`user-detail-${activity.userId}`}
                    src={routes.admin.fragments.userDetail.href({ userId: String(activity.userId) })}
                    fallback={
                      <div mix={css({ fontSize: theme.fontSize.xs, color: theme.colors.text.muted })}>
                        Benutzerdetails werden geladen…
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
