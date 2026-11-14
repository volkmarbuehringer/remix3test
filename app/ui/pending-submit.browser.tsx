import { clientEntry, on, type Handle } from 'remix/component'
import button from './theme/button.ts'
import { Glyph, type GlyphName } from './theme/glyph/glyph.tsx'
import { table } from './mixins/admin-table.ts'

interface PendingSubmitButtonProps {
  /** Resting label; the submit button text as rendered in the HTML. */
  children: string
  /** Label while the containing frame is reloading. Defaults to `children` + "…". */
  pendingLabel?: string
  /** Optional glyph shown before the label in both states. */
  icon?: GlyphName
  /**
   * Grow into the remaining flex row. Defaults to true to preserve the existing
   * form-actions layout; the messages compose footer keeps its natural width.
   */
  stretch?: boolean
}

/**
 * Primary-tone submit button with pending feedback (guide 09 "Add pending
 * feedback").
 *
 * Disables itself and swaps the label while its own form submission is
 * pending. It listens for `rmx:submission`, which targets the actual submitter
 * and carries the submission's `finished` promise, instead of the frame's
 * reload events: an unrelated frame reload must not disable this button, and a
 * superseded submission finishes aborted without a `reloadComplete` (#12183).
 */
export const PendingSubmitButton = clientEntry(
  import.meta.url + '#PendingSubmitButton',
  function PendingSubmitButton(handle: Handle<PendingSubmitButtonProps>) {
    let pending = false

    return () => {
      let { children, pendingLabel, icon, stretch = true } = handle.props
      let label = pending ? (pendingLabel ?? `${children}…`) : children
      return (
        <button
          type="submit"
          disabled={pending}
          mix={[
            button({ tone: 'primary' }),
            on('rmx:submission', async (event, signal) => {
              pending = true
              void handle.update()
              try {
                await event.finished
              } catch {
                // The frame runtime reports the failure; just leave pending state.
              }
              if (signal.aborted) return
              pending = false
              void handle.update()
            }),
            stretch ? table.spacer : undefined,
          ]}
        >
          {icon ? (
            <>
              <Glyph name={icon} width={14} height={14} />{' '}
            </>
          ) : null}
          {label}
        </button>
      )
    }
  },
)
