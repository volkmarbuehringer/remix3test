import { clientEntry, css, type Handle, type SerializableProps } from 'remix/ui'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface ConnectionIndicatorProps extends SerializableProps {
  url: string
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
  function ConnectionIndicator(handle: Handle) {
    let state: ConnectionState = 'connecting'
    let eventSource: EventSource | null = null
    let props = handle.props as unknown as ConnectionIndicatorProps
    let subscriptionUrl = props.url

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
        // An invalidate event signals that data has changed on the server.
        // Reload the parent frame so the page reflects the latest state.
        handle.frame.reload()
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
        <div mix={indicatorContainerStyle} aria-live="polite" aria-label={`SSE connection: ${stateText}`}>
          <style>{`@keyframes sse-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          <span
            mix={dotStyle}
            style={{
              background: dotColor,
              animation: pulse ? `sse-pulse 1.5s ease-in-out infinite` : 'none',
            }}
          />
          <span mix={stateTextStyle}>{stateText}</span>
        </div>
      )
    }
  },
)

function getStateStyles(
  state: ConnectionState,
): { stateText: string; dotColor: string; pulse: boolean } {
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
