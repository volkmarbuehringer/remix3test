import { Frame, css, type Handle } from 'remix/component'
import { theme } from '../../ui/theme/theme.ts'
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
  overflowY: 'auto',
  maxHeight: '153px',
  paddingRight: theme.space.xs,
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

// Rendered by the built-in lazy frame as its server-side fallback. It must
// render an element so the runtime can observe when the disclosure opens.
const placeholderStyle = css({
  display: 'inline-block',
  minHeight: '1rem',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
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
                      von <strong>Benutzer #{activity.userId}</strong> &middot;{' '}
                      {timeAgo(activity.time)}
                    </div>
                  </div>
                </div>
                {/* Native <details>/<summary> disclosure widget — clickable,
                  toggles frame visibility, requires zero JS. An <a> would
                  trigger the navigation intercept and reload the top-level
                  Document frame with fragment HTML, causing
                  Node.insertBefore DOMException. The user-detail frame uses
                  the runtime's built-in lazy loading: the disclosure ships
                  collapsed, so resolving it up front fetched content nobody
                  had asked to see. The frame loads when the open disclosure
                  nears the viewport and stays mounted afterwards. */}
                <details>
                  <summary mix={detailBtnStyle}>Details anzeigen</summary>
                  <div mix={nestedFrameContainer}>
                    <Frame
                      // `name` is load-bearing, not bookkeeping: it makes the
                      // request carry X-Remix-Target, which routes an expired
                      // session through requireAuth's sub-frame 401 and the
                      // client's full-page login redirect. Without it the 302
                      // falls through and injects the login document into the
                      // disclosure (see app/middleware/auth.ts).
                      // The row id, not the user id: two activities can share a
                      // user, and duplicate frame names overwrite each other in
                      // the runtime's named-frame registry.
                      name={`user-detail-${activity.id}`}
                      src={routes.admin.fragments.userDetail.href({
                        userId: String(activity.userId),
                      })}
                      loading="lazy"
                      fallback={<span mix={placeholderStyle}>Benutzerdetails werden geladen…</span>}
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
