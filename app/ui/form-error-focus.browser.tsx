import { clientEntry, css, ref, type Handle } from 'remix/component'

/**
 * Moves focus to the first invalid field after a validation-failure re-render.
 *
 * Server-rendered field errors carry `aria-invalid="true"` on the rejected
 * control, so a keyboard/screen-reader user is taken straight to the problem
 * instead of being left at the top of the frame. A form-level error (one that
 * no single control caused, e.g. "Mindestens ein Tag muss einen Zeitraum
 * haben") has no invalid field; the panel marks its banner with
 * `data-form-error` and focus lands there instead. Rendered inside the form.
 *
 * The ref covers the first render. A frame reload that re-renders the panel can
 * reuse this entry's node without calling the ref again, so the same lookup
 * also runs on every `reloadComplete` — otherwise the error would be rendered but
 * focus would sit on the replaced submit button's fallback (document.body).
 */
export const FormErrorFocus = clientEntry(
  import.meta.url + '#FormErrorFocus',
  function FormErrorFocus(handle: Handle) {
    function focusProblem(scope: ParentNode): void {
      let target =
        scope.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        scope.querySelector<HTMLElement>('[data-form-error]')
      target?.focus()
    }

    // Schedule the listener after the client commit (guide 05 §"DOM
    // references, global events, and cleanup"); the queued task is a no-op
    // during SSR.
    handle.queueTask(() => {
      if (typeof document === 'undefined') return
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          focusProblem(document)
        },
        { signal: handle.signal },
      )
    })

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            if (!el || typeof document === 'undefined') return
            focusProblem(el.closest('form') ?? document)
          }),
        ]}
      />
    )
  },
)
