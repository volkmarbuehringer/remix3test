import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ListsSearch = clientEntry(
  import.meta.url + '#ListsSearch',
  function ListsSearch(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el: HTMLElement) => {
            let input = document.getElementById('lists-sidebar-search') as HTMLInputElement | null
            if (!input) return

            // Refocus the input after reload if it has content
            if (input.value.trim()) {
              input.focus()
            }

            let timer: ReturnType<typeof setTimeout> | null = null

            function doSearch(value: string) {
              let currentUrl = new URL(handle.frame.src, location.origin)
              let load = currentUrl.searchParams.get('load')
              let params = new URLSearchParams()
              if (value.trim()) {
                params.set('filter', value.trim())
              }
              if (load) {
                params.set('load', load)
              }
              let href = '/lists' + (params.toString() ? '?' + params.toString() : '')
              handle.frame.src = href
              handle.frame.reload().catch(() => {})
            }

            input.addEventListener(
              'input',
              () => {
                if (timer) clearTimeout(timer)
                timer = setTimeout(() => {
                  timer = null
                  doSearch(input!.value)
                }, 250)
              },
              { signal: handle.signal },
            )

            return () => {
              if (timer) clearTimeout(timer)
            }
          }),
        ]}
      />
    )
  },
)
