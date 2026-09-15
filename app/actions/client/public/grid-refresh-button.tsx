import { clientEntry, css, on, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'

const refreshBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  minHeight: theme.control.height.sm,
  padding: `0 ${theme.space.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
  '&:disabled': { opacity: 0.6, cursor: 'default' },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '1px',
  },
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
        disabled={pending}
        mix={[
          refreshBtnStyle,
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
        {pending ? '⟳ Aktualisieren…' : '↻ Aktualisieren'}
      </button>
    )
  },
)
