import { clientEntry, type Handle } from 'remix/component'
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
 * Disables itself and swaps the label while the containing frame is reloading
 * after a native form submit. Frame reload events only fire in the browser, so
 * listeners are registered behind `typeof document` — registering during SSR
 * passes the frozen AbortSignal-shaped `handle.signal` stub to native
 * `addEventListener`, which Bun rejects (see remix3-tooling § Bun Runtime).
 */
export const PendingSubmitButton = clientEntry(
  import.meta.url + '#PendingSubmitButton',
  function PendingSubmitButton(handle: Handle<PendingSubmitButtonProps>) {
    let pending = false

    if (typeof document !== 'undefined') {
      handle.frame.addEventListener(
        'reloadStart',
        () => {
          pending = true
          void handle.update()
        },
        { signal: handle.signal },
      )

      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          pending = false
          void handle.update()
        },
        { signal: handle.signal },
      )
    }

    return () => {
      let { children, pendingLabel, icon, stretch = true } = handle.props
      let label = pending ? (pendingLabel ?? `${children}…`) : children
      return (
        <button
          type="submit"
          disabled={pending}
          mix={[button({ tone: 'primary' }), stretch ? table.spacer : undefined]}
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
