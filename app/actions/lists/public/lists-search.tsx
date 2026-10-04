import { clientEntry, css, ref, type Handle } from 'remix/component'

/**
 * Progressive enhancement for the sidebar list search.
 *
 * The search is a plain GET form targeting the lists-content frame (the browser
 * serializes `filter` and the hidden open-list `load` id into the URL), so it
 * works without JS and no longer builds URLs in the client. This entry only
 * restores the live behaviour: debounce typing into a submit, clear + resubmit
 * on Escape, and refocus after a frame reload when a filter is active.
 */
export const ListsSearch = clientEntry(
  import.meta.url + '#ListsSearch',
  function ListsSearch(handle: Handle) {
    let controllers: AbortController[] = []

    function init() {
      // The sidebar DOM can be reused or replaced by a frame reload; drop the
      // previous listeners first so a re-init cannot stack them.
      for (let ac of controllers) ac.abort()
      controllers = []

      let input = document.getElementById('lists-sidebar-search') as HTMLInputElement | null
      let form = input?.closest('form') as HTMLFormElement | null
      if (!input || !form) return

      // Refocus after a reload so continued typing keeps working.
      if (input.value.trim()) input.focus()

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
            input.focus()
          }
        },
        { signal: ac.signal },
      )

      ac.signal.addEventListener('abort', () => {
        if (timer) clearTimeout(timer)
      })
    }

    if (handle.frame) {
      handle.frame.addEventListener('reloadComplete', init, { signal: handle.signal })
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref(() => {
            if (typeof document === 'undefined') return
            init()
          }),
        ]}
      />
    )
  },
)
