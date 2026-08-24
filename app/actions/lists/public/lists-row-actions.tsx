import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ListsRowActions = clientEntry(
  import.meta.url + '#ListsRowActions',
  function ListsRowActions(handle: Handle) {
    let controllers: AbortController[] = []

    function init() {
      for (let ac of controllers) ac.abort()
      controllers = []

      let rows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
      if (rows.length === 0) return

      function reveal(target: HTMLElement) {
        for (let el of target.querySelectorAll<HTMLElement>('[data-list-row-action]')) {
          el.style.opacity = '1'
        }
      }

      function dim(target: HTMLElement) {
        for (let el of target.querySelectorAll<HTMLElement>('[data-list-row-action]')) {
          el.style.opacity = ''
        }
      }

      for (let row of rows) {
        let ac = new AbortController()
        controllers.push(ac)

        row.addEventListener('mouseenter', () => reveal(row), { signal: ac.signal })
        row.addEventListener('mouseleave', () => dim(row), { signal: ac.signal })
        row.addEventListener(
          'focusin',
          (e) => {
            let target = e.target as HTMLElement
            if (row.contains(target)) reveal(row)
          },
          { signal: ac.signal },
        )
        row.addEventListener(
          'focusout',
          (e) => {
            let target = e.relatedTarget as HTMLElement | null
            if (!target || !row.contains(target)) dim(row)
          },
          { signal: ac.signal },
        )
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref(() => {
            if (typeof document === 'undefined') return
            init()
            handle.frame.addEventListener('reloadComplete', init, {
              signal: handle.signal,
            })
          }),
        ]}
      />
    )
  },
)
