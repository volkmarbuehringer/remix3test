import { clientEntry, type Handle } from 'remix/component'

/**
 * Quiet period after the last keystroke before the grid reloads. Long enough
 * that typing a word does not fire one request per character, short enough that
 * the results feel tied to the input.
 */
const SEARCH_DEBOUNCE_MS = 350

/**
 * Live search for the uploads grid.
 *
 * The filter bar is a plain GET form (so it works without JavaScript and the
 * Suchen button remains the explicit path). With this entry, typing in the
 * search field re-submits that form after a short pause, which navigates the
 * enclosing frame and re-renders the grid with the new filter.
 *
 * Two details keep the interaction usable:
 *
 * - Only a changed value is submitted, so the frame reload that follows cannot
 *   loop.
 * - A frame reload replaces the search input and drops its focus. When the
 *   submit came from the focused input, the caret is put back at the end of the
 *   new input so the user can keep typing instead of having to click again.
 *
 * Listeners are delegated from `document` because the form is replaced on every
 * frame navigation; `handle.signal` removes them when the entry disconnects.
 */
export const UploadsFilterAutoSubmit = clientEntry(
  import.meta.url + '#UploadsFilterAutoSubmit',
  function UploadsFilterAutoSubmit(handle: Handle) {
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSubmitted = ''
    let restoreFocus = false

    function currentForm(): HTMLFormElement | null {
      return document.querySelector<HTMLFormElement>('form[data-uploads-filter]')
    }

    function currentInput(): HTMLInputElement | null {
      return currentForm()?.querySelector<HTMLInputElement>('input[name="filter"]') ?? null
    }

    function submitFrom(input: HTMLInputElement) {
      let form = input.closest('form[data-uploads-filter]') as HTMLFormElement | null
      if (!form) return
      lastSubmitted = input.value
      restoreFocus = document.activeElement === input
      // An emptied search returns to the plain grid URL instead of leaving an
      // empty `filter=` parameter behind. The name is restored right after
      // requestSubmit(), which reads the form synchronously.
      let stripEmpty = input.value.trim() === ''
      if (stripEmpty) input.removeAttribute('name')
      form.requestSubmit()
      if (stripEmpty) input.name = 'filter'
    }

    function scheduleSubmit() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        let input = currentInput()
        if (!input) return
        if (input.value.trim() === lastSubmitted.trim()) return
        submitFrom(input)
      }, SEARCH_DEBOUNCE_MS)
    }

    handle.queueTask(() => {
      if (typeof document === 'undefined') return

      // Seed the comparison with the filter currently rendered into the field.
      // Starting at '' made the first clear-to-empty (Backspace, the native
      // search ×) compare equal and silently skip the reload on a page opened
      // with ?filter=…
      lastSubmitted = currentInput()?.value ?? ''

      document.addEventListener(
        'input',
        (event) => {
          let target = event.target
          if (!(target instanceof HTMLInputElement)) return
          if (!target.matches('form[data-uploads-filter] input[name="filter"]')) return
          scheduleSubmit()
        },
        { signal: handle.signal },
      )

      // An explicit submit (Enter or the Suchen button) should restore focus the
      // same way a debounced one does when the field was focused.
      document.addEventListener(
        'submit',
        (event) => {
          let form = event.target
          if (!(form instanceof HTMLFormElement)) return
          if (!form.matches('form[data-uploads-filter]')) return
          let input = form.querySelector<HTMLInputElement>('input[name="filter"]')
          if (!input) return
          lastSubmitted = input.value
          restoreFocus = document.activeElement === input
        },
        { capture: true, signal: handle.signal },
      )

      // Escape clears the search immediately — a familiar "reset this field"
      // gesture, and it does not have to wait for the debounce.
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape') return
          let target = event.target
          if (!(target instanceof HTMLInputElement)) return
          if (!target.matches('form[data-uploads-filter] input[name="filter"]')) return
          if (target.value === '') return
          if (timer) clearTimeout(timer)
          target.value = ''
          submitFrom(target)
        },
        { signal: handle.signal },
      )

      // The form is marked data-rmx-reset-focus="manual", so the frame runtime
      // does not move focus to the document after the reload. The input itself
      // is still replaced with the freshly rendered one, so put the caret back
      // when this entry triggered the navigation.
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          // The server-rendered value is now the source of truth (the filter can
          // also change through "Zurücksetzen" or a kind-tab navigation), so a
          // later clear still differs from what is displayed.
          lastSubmitted = currentInput()?.value ?? lastSubmitted
          if (!restoreFocus) return
          let input = currentInput()
          if (!input) return
          restoreFocus = false
          input.focus({ preventScroll: true })
          let end = input.value.length
          input.setSelectionRange(end, end)
        },
        { signal: handle.signal },
      )
    })

    handle.signal.addEventListener('abort', () => {
      if (timer) clearTimeout(timer)
    })

    return () => null
  },
)
