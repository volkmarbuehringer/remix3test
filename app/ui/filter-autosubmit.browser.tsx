import { clientEntry, type Handle } from 'remix/component'

/**
 * Quiet period after the last keystroke before the grid reloads. Long enough
 * that typing a word does not fire one request per character, short enough that
 * the results feel tied to the input.
 */
const SEARCH_DEBOUNCE_MS = 350

interface FilterAutoSubmitProps {
  /** CSS selector for the GET form that owns the `filter` input. */
  formSelector: string
}

/**
 * Live search for an admin grid filter bar.
 *
 * The filter bar is a plain GET form (so it works without JavaScript and the
 * Suchen button remains the explicit path). With this entry, typing in the
 * search field re-submits that form after a short pause, which navigates the
 * enclosing frame and re-renders the grid with the new filter.
 *
 * Three details keep the interaction usable:
 *
 * - Only a changed value is submitted, so the frame reload that follows cannot
 *   loop.
 * - A frame reload replaces the search input and drops its focus. When the
 *   submit came from the focused input, the caret is put back at the end of the
 *   new input so the user can keep typing instead of having to click again.
 * - Text typed while a reload is already in flight is preserved and submitted
 *   after the swap. Without that, the replacement input silently dropped the
 *   keystrokes and the pending debounce compared equal against the new value.
 *
 * Listeners are delegated from `document` because the form is replaced on every
 * frame navigation; `handle.signal` removes them when the entry disconnects.
 */
export const FilterAutoSubmit = clientEntry(
  import.meta.url + '#FilterAutoSubmit',
  function FilterAutoSubmit(handle: Handle<FilterAutoSubmitProps>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    /** Filter the grid is currently rendered for (the last submitted value). */
    let lastSubmitted = ''
    /** Latest field value, including text typed but not submitted yet. */
    let latestValue = ''
    let restoreFocus = false
    let focusedBeforeReload = false

    function currentForm(): HTMLFormElement | null {
      let { formSelector } = handle.props
      return document.querySelector<HTMLFormElement>(formSelector)
    }

    function currentInput(): HTMLInputElement | null {
      return currentForm()?.querySelector<HTMLInputElement>('input[name="filter"]') ?? null
    }

    function ownsFilterInput(target: EventTarget | null): target is HTMLInputElement {
      if (!(target instanceof HTMLInputElement)) return false
      return target.name === 'filter' && target.closest(handle.props.formSelector) !== null
    }

    function focusAtEnd(input: HTMLInputElement): void {
      input.focus({ preventScroll: true })
      let end = input.value.length
      input.setSelectionRange(end, end)
    }

    /**
     * Marks the hydrated form so e2e tests can wait for the entry before typing
     * instead of racing the client entry and typing into a dead field.
     */
    function markReady(): void {
      currentForm()?.setAttribute('data-filter-autosubmit-ready', 'true')
    }

    function submitFrom(input: HTMLInputElement) {
      let form = input.closest(handle.props.formSelector) as HTMLFormElement | null
      if (!form) return
      lastSubmitted = input.value
      latestValue = input.value
      restoreFocus = document.activeElement === input
      // An emptied search returns to the plain grid URL instead of leaving an
      // empty `filter=` parameter behind. Disabling excludes the control from
      // the submission without renaming it, so the submit listener can still
      // find the field; the flag is restored right after requestSubmit().
      let stripEmpty = input.value.trim() === ''
      if (stripEmpty) input.disabled = true
      form.requestSubmit()
      if (stripEmpty) input.disabled = false
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
      let initial = currentInput()
      latestValue = initial?.value ?? ''
      lastSubmitted = latestValue

      document.addEventListener(
        'input',
        (event) => {
          if (!ownsFilterInput(event.target)) return
          latestValue = event.target.value
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
          if (!form.matches(handle.props.formSelector)) return
          let input = form.querySelector<HTMLInputElement>('input[name="filter"]')
          if (!input) return
          lastSubmitted = input.value
          latestValue = input.value
          // Keep a restore requested by submitFrom() when clearing disabled the
          // field (a disabled control is no longer the active element).
          restoreFocus = restoreFocus || document.activeElement === input
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
          if (!ownsFilterInput(target)) return
          if (target.value === '') return
          if (timer) clearTimeout(timer)
          target.value = ''
          latestValue = ''
          submitFrom(target)
        },
        { signal: handle.signal },
      )

      // A frame navigation replaces the input, so remember whether it was
      // focused; an unrelated reload must not steal focus from elsewhere.
      handle.frame.addEventListener(
        'reloadStart',
        () => {
          let input = currentInput()
          focusedBeforeReload = input !== null && document.activeElement === input
        },
        { signal: handle.signal },
      )

      // The form is marked data-rmx-reset-focus="manual", so the frame runtime
      // does not move focus to the document after the reload. The input itself
      // is still replaced with the freshly rendered one, so put the caret back
      // when the user was in the field and finish a search that was typed while
      // the reload was in flight.
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          markReady()
          let input = currentInput()
          // The frame replaces the input, so its server-rendered value is the
          // filter the grid now shows. If that differs from what we submitted,
          // a link changed the filter and that navigation wins over text typed
          // after the last submit. Otherwise the text is unsent input the swap
          // just dropped: restore it and let the debounce run again.
          let serverValue = input?.value ?? lastSubmitted
          let unsent = latestValue.trim() !== lastSubmitted.trim()
          let filterChanged = serverValue.trim() !== lastSubmitted.trim()

          if (input && unsent && !filterChanged) {
            input.value = latestValue
            if (restoreFocus || focusedBeforeReload) focusAtEnd(input)
            restoreFocus = false
            focusedBeforeReload = false
            scheduleSubmit()
            return
          }

          lastSubmitted = serverValue
          latestValue = serverValue
          let shouldRestoreFocus = restoreFocus
          restoreFocus = false
          focusedBeforeReload = false
          if (shouldRestoreFocus && input) focusAtEnd(input)
        },
        { signal: handle.signal },
      )

      markReady()
    })

    handle.signal.addEventListener('abort', () => {
      if (timer) clearTimeout(timer)
    })

    return () => null
  },
)
