import { clientEntry, css, ref, type Handle } from 'remix/component'

/**
 * Moves focus to the first invalid field after a validation-failure re-render.
 *
 * Server-rendered field errors carry `aria-invalid="true"` on the rejected
 * control, so a keyboard/screen-reader user is taken straight to the problem
 * instead of being left at the top of the frame. Rendered inside the form.
 */
export const FormErrorFocus = clientEntry(
  import.meta.url + '#FormErrorFocus',
  function FormErrorFocus(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            if (!el || typeof document === 'undefined') return
            let scope: ParentNode = el.closest('form') ?? document
            let target = scope.querySelector('[aria-invalid="true"]') as HTMLElement | null
            target?.focus()
          }),
        ]}
      />
    )
  },
)
