import { clientEntry, on, type Handle } from 'remix/component'
import button from './theme/button.ts'
import { Glyph, type GlyphName } from './theme/glyph/glyph.tsx'
import { table } from './mixins/admin-table.ts'

interface PendingSubmitButtonProps {
  /** Resting label; the submit button text as rendered in the HTML. */
  children: string
  /** Label while this button's own submission is in flight. Defaults to `children` + "…". */
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
 * Swaps the label while its own form submission is pending. It listens for
 * `rmx:navigation` (#12306), which targets the actual submitter and carries
 * the navigation's `finished` promise, instead of the frame's reload events:
 * an unrelated frame reload must not change this button, and a superseded
 * submission finishes aborted without a `reloadComplete`.
 *
 * The button stays enabled, as the guide requires, so the visitor can submit
 * again. The next submission aborts the earlier handler's signal and a newer
 * submission owns the pending state; `signal.aborted` keeps the finished
 * earlier handler from clearing it.
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
          mix={[
            button({ tone: 'primary' }),
            on('rmx:navigation', async (event, signal) => {
              pending = true
              void handle.update()
              try {
                await event.finished
              } catch {
                // The frame runtime reports the failure; clear pending below
                // so the button returns to its resting label.
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
