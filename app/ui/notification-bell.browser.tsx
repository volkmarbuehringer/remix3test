import { clientEntry, css, type Handle, type SerializableProps } from 'remix/ui'
import { theme } from './theme/theme.ts'

export interface NotificationBellProps extends SerializableProps {
  /** Per-user SSE endpoint that pushes a `new` event when a notification lands. */
  eventsUrl: string
  /** JSON endpoint returning `{ count }` for the current user's unread notifications. */
  unreadCountUrl: string
  /** Inbox page link the bell navigates to. */
  inboxUrl: string
}

/**
 * Bell + unread badge in the main nav.
 *
 * Subscribes to the per-user notification SSE channel and bumps the badge on a
 * live `new` event — no page reload. The initial count is fetched from
 * `unreadCountUrl` on mount so the badge is correct on a fresh page load, then
 * kept live by the stream.
 */
export const NotificationBell = clientEntry(
  import.meta.url + '#NotificationBell',
  function NotificationBellEntry(handle: Handle<NotificationBellProps>) {
    let count = 0
    let eventSource: EventSource | null = null
    let started = false

    function syncCount() {
      let { unreadCountUrl } = handle.props
      if (!unreadCountUrl) return
      fetch(unreadCountUrl)
        .then((r) => r.json())
        .then((data) => {
          count = typeof data?.count === 'number' ? data.count : 0
          handle.update()
        })
        .catch(() => {})
    }

    handle.queueTask(() => {
      if (started) return
      started = true

      syncCount()

      let { eventsUrl } = handle.props
      if (!eventsUrl || typeof EventSource === 'undefined') return
      eventSource = new EventSource(eventsUrl)
      eventSource.addEventListener('new', () => {
        count++
        handle.update()
      })
      handle.signal.addEventListener('abort', () => {
        eventSource?.close()
        eventSource = null
      })
    })

    return () => {
      let { inboxUrl } = handle.props
      return (
        <a
          href={inboxUrl}
          mix={bellLinkCss}
          aria-label="Benachrichtigungen"
          title="Benachrichtigungen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" mix={bellSvgCss}>
            <path
              d="M12 3a5.5 5.5 0 0 0-5.5 5.5V13l-1.8 3.2A.6.6 0 0 0 5.25 17h13.5a.6.6 0 0 0 .55-.8L17.5 13V8.5A5.5 5.5 0 0 0 12 3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 19.5a2.5 2.5 0 0 0 5 0"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          {count > 0 ? (
            <span mix={badgeCss} data-bell-count>
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </a>
      )
    }
  },
)

const bellLinkCss = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  borderRadius: theme.radius.sm,
  color: theme.colors.text.primary,
  textDecoration: 'none',
})

const bellSvgCss = css({
  flexShrink: 0,
})

const badgeCss = css({
  position: 'absolute',
  top: '-4px',
  right: '-6px',
  minWidth: '16px',
  height: '16px',
  padding: '0 4px',
  borderRadius: theme.radius.full,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: '10px',
  lineHeight: '16px',
  fontWeight: 700,
  textAlign: 'center',
})
