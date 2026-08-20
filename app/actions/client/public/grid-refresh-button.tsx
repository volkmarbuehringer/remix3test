import { clientEntry, css, on, type Handle } from 'remix/ui'

const smallBtnStyle = css({
  minHeight: '1.75rem',
  paddingInline: '0.5rem',
  fontSize: '0.75rem',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
})

/**
 * Inline refresh button for the client grid.
 * Calls `handle.frame.reload()` to refresh just this frame's content
 * without affecting the parent page or sibling frames.
 */
export const FrameRefreshButton = clientEntry(
  import.meta.url,
  function FrameRefreshButton(handle: Handle) {
    let pending = false

    return () => (
      <button
        type="button"
        mix={[
          smallBtnStyle,
          on('click', async () => {
            if (pending) return
            pending = true
            handle.update()
            try {
              let signal = await handle.frame.reload()
              if (signal.aborted) {
                pending = false
                handle.update()
                return
              }
            } catch {
              // reload failed, still reset pending state
            }
            pending = false
            handle.update()
          }),
        ]}
      >
        {pending ? '⟳' : '↻ Refresh'}
      </button>
    )
  },
)
