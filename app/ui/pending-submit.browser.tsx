import { clientEntry, type Handle } from 'remix/component'
import button from './theme/button.ts'
import { table } from './mixins/admin-table.ts'

interface PendingSubmitButtonProps {
  /** Resting label; the submit button text as rendered in the HTML. */
  children: string
  /** Label while the containing frame is reloading. Defaults to `children` + "…". */
  pendingLabel?: string
}

/**
 * Primary-tone submit button with pending feedback (guide 09 "Add pending
 * feedback").
 *
 * Disables itself and swaps the label while the containing frame is reloading
 * after a native form submit. Frame reload events only fire in the browser, so
 * listeners are registered behind `typeof document` — registering during SSR
 * passes the frozen AbortSignal-shaped `handle.signal` stub to native
 * `addEventListener`, which Bun rejects (see remix3-bun-runtime).
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
          handle.update()
        },
        { signal: handle.signal },
      )

      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          pending = false
          handle.update()
        },
        { signal: handle.signal },
      )
    }

    return () => (
      <button type="submit" disabled={pending} mix={[button({ tone: 'primary' }), table.spacer]}>
        {pending
          ? (handle.props.pendingLabel ?? `${handle.props.children}…`)
          : handle.props.children}
      </button>
    )
  },
)
