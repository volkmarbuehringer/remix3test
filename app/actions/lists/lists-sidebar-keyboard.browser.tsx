import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { findTypeaheadTarget, nextFocusIndex } from '../../utils/lists-keyboard.ts'

export const ListsSidebarKeyboard = clientEntry(
  import.meta.url + '#ListsSidebarKeyboard',
  function ListsSidebarKeyboard(handle: Handle) {
    let rovingControllers: AbortController[] = []

    function initRoving() {
      // The sidebar DOM persists across frame reloads, so a re-init would
      // otherwise stack a new listener on every row per navigation. Abort the
      // previous batch first.
      for (let ac of rovingControllers) ac.abort()
      rovingControllers = []

      let rows = Array.from(
        document.querySelectorAll<HTMLElement>('[data-list-id]'),
      ).filter((el) => Number.isFinite(Number(el.dataset.listId)))
      if (rows.length === 0) return

      // Single tab stop: first row tabbable, the rest skipped (roving tabindex)
      rows.forEach((row, i) => row.setAttribute('tabindex', i === 0 ? '0' : '-1'))

      rows.forEach((row) => {
        let ac = new AbortController()
        rovingControllers.push(ac)
        row.addEventListener(
          'keydown',
          (e) => {
            let target = e.target as HTMLElement
            let isRowTarget = target === row
            let idx = rows.indexOf(row)

            let navigate = (href: string | null) => {
              if (!href || !handle.frame) return
              handle.frame.src = href
              handle.frame.reload().catch(() => {})
            }

            switch (e.key) {
              case 'ArrowDown':
              case 'ArrowUp':
              case 'Home':
              case 'End': {
                e.preventDefault()
                let target = nextFocusIndex(rows.length, idx, e.key)
                moveFocus(rows, target)
                break
              }
              case 'Enter':
              case ' ':
                // Only when the row itself is focused (not the inner link/button,
                // which keeps its own Enter behavior, e.g. rename-on-Enter).
                if (isRowTarget) {
                  e.preventDefault()
                  e.stopPropagation()
                  let href = row.querySelector('a[href]')?.getAttribute('href') ?? null
                  navigate(href)
                }
                break
              default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  let labels = rows.map(
                    (r) =>
                      ({
                        label: r.querySelector('[data-list-name]')?.textContent ?? '',
                      }) as { label: string },
                  )
                  let target = findTypeaheadTarget(labels, idx, e.key)
                  if (target !== -1) {
                    e.preventDefault()
                    moveFocus(rows, target)
                  }
                }
                break
            }
          },
          { signal: ac.signal },
        )
      })
    }

    function moveFocus(rows: HTMLElement[], target: number) {
      if (target < 0 || target >= rows.length) return
      rows.forEach((r) => r.setAttribute('tabindex', '-1'))
      rows[target].setAttribute('tabindex', '0')
      rows[target].focus()
    }

    // All DOM work happens in the ref callback, which only runs on the client.
    // (Calling document.* during SSR throws "document is not defined".)
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref(() => {
            if (typeof document === 'undefined') return
            initRoving()
            handle.frame.addEventListener('reloadComplete', initRoving, {
              signal: handle.signal,
            })
          }),
        ]}
      />
    )
  },
)
