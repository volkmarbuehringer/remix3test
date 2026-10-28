import { clientEntry, css, ref, type Handle } from 'remix/component'

/**
 * Focuses the primary field of a server-rendered inline editor when its frame
 * render commits.
 *
 * The `autofocus` attribute only runs during the initial document parse. The
 * admin editors open through a frame navigation, where the browser ignores it,
 * so the field would stay unfocused and a keyboard user would have to tab from
 * the top of the frame. This entry lives inside the editor form and runs on
 * every hydration, including a validation-error re-render.
 *
 * Mark the target with `data-editor-autofocus-field`; the first one inside the
 * enclosing form wins.
 */
export const EditorAutofocus = clientEntry(
  import.meta.url + '#EditorAutofocus',
  function EditorAutofocus(_handle: Handle) {
    return () => (
      <span
        data-editor-autofocus="true"
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            if (!el || typeof document === 'undefined') return
            let form = el.closest('form')
            let field = form?.querySelector<HTMLElement>('[data-editor-autofocus-field]')
            field?.focus()
          }),
        ]}
      />
    )
  },
)
