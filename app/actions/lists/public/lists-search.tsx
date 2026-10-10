import { clientEntry, css, ref, type Handle } from 'remix/component'

/**
 * Progressive enhancement for the sidebar list search.
 *
 * The search is a plain GET form targeting the lists-content frame (the browser
 * serializes `filter` and the hidden open-list `load` id into the URL), so it
 * works without JS and no longer builds URLs in the client. This entry drives
 * the interactive layer: debounced typing into a submit, and clear + resubmit
 * on Escape. The field keeps focus across every submit-navigation because the
 * form is marked `data-rmx-reset-focus="manual"` (remix #11939), so the
 * previous reloadComplete refocus hack is retired. We still focus on initial
 * mount when the field arrives with a filter already set (e.g. arriving via
 * `?filter=...` or back/forward navigation), which is not a navigation.
 */
export const ListsSearch = clientEntry(
  import.meta.url + '#ListsSearch',
  function ListsSearch(handle: Handle) {
    let controllers: AbortController[] = []

    function wire() {
      // The sidebar DOM can be reused or replaced by a frame reload; drop the
      // previous listeners first so a re-bind cannot stack them.
      for (let ac of controllers) ac.abort()
      controllers = []

      let input = document.getElementById('lists-sidebar-search') as HTMLInputElement | null
      let form = input?.closest('form') as HTMLFormElement | null
      if (!input || !form) return

      let ac = new AbortController()
      controllers.push(ac)
      let timer: ReturnType<typeof setTimeout> | null = null
      let submit = () => form.requestSubmit()

      input.addEventListener(
        'input',
        () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            timer = null
            submit()
          }, 400)
        },
        { signal: ac.signal },
      )

      input.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape' && input.value) {
            event.preventDefault()
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
            input.value = ''
            submit()
          }
        },
        { signal: ac.signal },
      )

      ac.signal.addEventListener('abort', () => {
        if (timer) clearTimeout(timer)
      })
    }

    function mount() {
      wire()
      let input = document.getElementById('lists-sidebar-search') as HTMLInputElement | null
      if (input && input.value.trim()) input.focus()
    }

    // Frame reload events only fire in the browser. Registering during SSR passes
    // @remix-run/component's frozen AbortSignal-shaped `handle.signal` stub to
    // native addEventListener, which Bun rejects (`TypeError: Type error`); Node
    // tolerates it. See remix3-bun-runtime.
    if (handle.frame && typeof document !== 'undefined') {
      handle.frame.addEventListener('reloadComplete', wire, { signal: handle.signal })
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref(() => {
            if (typeof document === 'undefined') return
            mount()
          }),
        ]}
      />
    )
  },
)
