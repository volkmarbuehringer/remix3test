import { clientEntry, css, on, type Handle } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { routes } from '../routes.ts'

/**
 * Toggle that demonstrates root reload entry lifecycle.
 *
 * Shows view toggle buttons that use `handle.frames.top.reload()`
 * to do a document-level reload. Registers an abort handler for cleanup
 * that fires when the entry is disposed during a reload.
 */
export const AdminViewToggle = clientEntry(
  import.meta.url,
  function AdminViewToggle(handle: Handle) {
    let pendingHref: string | null = null
    let cleanupCount = 0

    // Register cleanup handler — fires on root reload or unmount
    handle.signal.addEventListener('abort', () => {
      cleanupCount++
      console.info('[AdminViewToggle] Cleaned up, total cleanups:', cleanupCount)
    })

    async function reloadTopFrame(src: string) {
      if (pendingHref) return
      pendingHref = src
      handle.update()

      handle.frames.top.src = src
      let signal = await handle.frames.top.reload()
      if (signal.aborted) return

      pendingHref = null
      handle.update()
    }

    return () => (
      <div
        mix={css({
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          padding: '0.5rem',
          fontSize: '0.75rem',
        })}
      >
        <span
          mix={css({
            color: theme.colors.text.muted,
            fontSize: '0.7rem',
          })}
        >
          View:
        </span>
        <button
          type="button"
          mix={[
            css({
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              border: `1px solid ${theme.colors.border.default}`,
              background: pendingHref === routes.admin.index.href() ? theme.colors.action.secondary.backgroundHover : theme.colors.action.secondary.background,
              color: theme.colors.action.secondary.foreground,
              cursor: 'pointer',
              fontSize: '0.75rem',
              '&:hover': { background: theme.colors.action.secondary.backgroundHover },
            }),
            on('click', () => reloadTopFrame(routes.admin.index.href())),
          ]}
          disabled={pendingHref !== null}
        >
          {pendingHref === routes.admin.index.href() ? 'Loading Dashboard…' : 'Dashboard'}
        </button>
        <button
          type="button"
          mix={[
            css({
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              border: `1px solid ${theme.colors.border.default}`,
              background: theme.colors.action.secondary.background,
              color: theme.colors.action.secondary.foreground,
              cursor: 'pointer',
              fontSize: '0.75rem',
              '&:hover': { background: theme.colors.action.secondary.backgroundHover },
            }),
            on('click', () =>
              reloadTopFrame(routes.admin.chatlog.index.href()),
            ),
          ]}
          disabled={pendingHref !== null}
        >
          {pendingHref === routes.admin.chatlog.index.href()
            ? 'Loading Chatlog…'
            : 'Chatlog'}
        </button>
        
      </div>
    )
  },
)
