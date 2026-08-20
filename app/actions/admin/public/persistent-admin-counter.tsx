import { clientEntry, css, on, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'

/**
 * Demo client entry that persists across root reloads.
 *
 * Demonstrates:
 * - `handle.queueTask()` for post-hydration setup (incrementing setup counter)
 * - `handle.signal.addEventListener('abort')` for cleanup
 * - Local state that survives `handle.frames.top.reload()`
 *
 * The setup ID increments on each hydation, showing when re-creation happens.
 * The local count preserves across root reloads since the entry is re-reconciled.
 */
export const PersistentAdminCounter = clientEntry(
  import.meta.url,
  function PersistentAdminCounter(handle: Handle) {
    let localCount = 0
    let setupId = 0
    let disposeCount = 0

    // Post-hydration setup: runs once after the first client render
    handle.queueTask(() => {
      setupId++
      handle.update()
    })

    // Cleanup handler: fires when entry is removed from DOM
    handle.signal.addEventListener('abort', () => {
      disposeCount++
      console.info(`[PersistentAdminCounter] Disposed. Total disposes: ${disposeCount}`)
    })

    return () => (
      <div
        mix={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          fontSize: '0.75rem',
          borderTop: `1px solid ${theme.colors.border.default}`,
          marginTop: '0.25rem',
        })}
      >
        <span
          mix={css({
            color: theme.colors.text.muted,
            fontSize: '0.7rem',
          })}
        >
          Persist Counter:
        </span>
        <span
          mix={css({
            color: theme.colors.text.primary,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          })}
        >
          {localCount}
        </span>
        <button
          type="button"
          mix={[
            css({
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              border: `1px solid ${theme.colors.border.default}`,
              background: theme.colors.action.secondary.background,
              color: theme.colors.action.secondary.foreground,
              cursor: 'pointer',
              fontSize: '0.7rem',
              lineHeight: '1',
              '&:hover': { background: theme.colors.action.secondary.backgroundHover },
            }),
            on('click', () => {
              localCount++
              handle.update()
            }),
          ]}
        >
          +
        </button>
        <button
          type="button"
          mix={[
            css({
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              border: `1px solid ${theme.colors.border.default}`,
              background: theme.colors.action.secondary.background,
              color: theme.colors.action.secondary.foreground,
              cursor: 'pointer',
              fontSize: '0.7rem',
              lineHeight: '1',
              '&:hover': { background: theme.colors.action.secondary.backgroundHover },
            }),
            on('click', () => {
              localCount--
              handle.update()
            }),
          ]}
        >
          −
        </button>
        <span
          mix={css({
            color: theme.colors.text.muted,
            fontSize: '0.65rem',
          })}
        >
          setup: #{setupId} {disposeCount > 0 ? `| disposed: ${disposeCount}x` : ''}
        </span>
      </div>
    )
  },
)
