import { clientEntry, css, type Handle, type SerializableProps } from 'remix/ui'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

export interface ConnectionIndicatorProps extends SerializableProps {
  url: string
  /** How to reload when an 'invalidate' event is received.
   *  'frame' (default) calls handle.frame.reload() — for pages inside a Frame.
   *  'window' calls window.location.reload() — for standalone pages. */
  reloadMode?: 'frame' | 'window'
  /** Optional list of URL search param names. When any of these params
   *  are present in the current URL, invalidate events will NOT trigger
   *  a reload (e.g., skip reload during editing). */
  skipReloadParams?: string[]
}

/**
 * Client-side SSE connection status indicator.
 *
 * Renders a colored dot + status text reflecting the current state of
 * an `EventSource` subscription. The component automatically cleans up
 * the connection when removed from the DOM.
 *
 * @example
 * ```tsx
 * <div mix={containerStyle}>
 *   <ConnectionIndicator url="/admin/messages/subscribe" />
 * </div>
 * ```
 */
export const ConnectionIndicator = clientEntry(
  import.meta.url,
  function ConnectionIndicator(handle: Handle<ConnectionIndicatorProps>) {
    let state: ConnectionState = 'connecting'
    let eventSource: EventSource | null = null
    let props = handle.props
    let subscriptionUrl = props.url
    let reloadMode = props.reloadMode ?? 'frame'
    let skipReloadParams = props.skipReloadParams ?? []

    // Post-hydration setup: establish the SSE connection
    handle.queueTask(() => {
      if (!subscriptionUrl) return

      eventSource = new EventSource(subscriptionUrl)

      eventSource.addEventListener('open', () => {
        state = 'connected'
        handle.update()
      })

      eventSource.addEventListener('connected', () => {
        state = 'connected'
        handle.update()
      })

      eventSource.addEventListener('invalidate', () => {
        // Skip reload if any guard params are present (e.g., editing, creating)
        if (skipReloadParams.length > 0) {
          let params = new URLSearchParams(window.location.search)
          for (let p of skipReloadParams) {
            if (params.has(p)) return
          }
        }
        // An invalidate event signals that data has changed on the server.
        // Reload according to the reloadMode: window reload for standalone
        // pages, frame reload for pages inside a Remix Frame.
        if (reloadMode === 'window') {
          window.location.reload()
        } else {
          handle.frame.reload()
        }
      })

      eventSource.addEventListener('error', () => {
        // EventSource auto-reconnects; show reconnecting on error.
        // If readyState is CLOSED, it won't auto-reconnect.
        if (eventSource?.readyState === EventSource.CLOSED) {
          state = 'disconnected'
        } else {
          state = 'reconnecting'
        }
        handle.update()
      })

      // Clean up the EventSource when this entry is removed from the DOM
      handle.signal.addEventListener('abort', () => {
        eventSource?.close()
        eventSource = null
      })
    })

    return () => {
      let { stateText, dotColor, pulse } = getStateStyles(state)

      return (
        <div
          mix={indicatorContainerStyle}
          aria-live="polite"
          aria-label={`SSE connection: ${stateText}`}
        >
          <style>{`@keyframes sse-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          <span
            mix={[
              dotStyle,
              css({
                background: dotColor,
                animation: pulse ? `sse-pulse 1.5s ease-in-out infinite` : 'none',
              }),
            ]}
          />
          <span mix={stateTextStyle}>{stateText}</span>
        </div>
      )
    }
  },
)

function getStateStyles(state: ConnectionState): {
  stateText: string
  dotColor: string
  pulse: boolean
} {
  switch (state) {
    case 'connected':
      return { stateText: 'Connected', dotColor: '#22c55e', pulse: true }
    case 'connecting':
      return { stateText: 'Connecting...', dotColor: '#f59e0b', pulse: true }
    case 'reconnecting':
      return { stateText: 'Reconnecting...', dotColor: '#f59e0b', pulse: true }
    case 'disconnected':
      return { stateText: 'Disconnected', dotColor: '#ef4444', pulse: false }
  }
}

// ── Styles ──

const indicatorContainerStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.25rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  lineHeight: '1',
  fontWeight: 500,
  whiteSpace: 'nowrap',
})

const dotStyle = css({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  flexShrink: 0,
})

const stateTextStyle = css({
  color: 'inherit',
})
