import { clientEntry, css, ref, type Handle } from 'remix/component'
import { findTypeaheadTarget, nextFocusIndex } from '../../../utils/lists-keyboard.ts'

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

      let rows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]')).filter((el) =>
        Number.isFinite(Number(el.dataset.listId)),
      )
      // The roving tab stop must be the row's anchor, not the wrapper: the anchor
      // is the interactive element, so leaving it natively tabbable made *every*
      // row a tab stop (the wrapper's tabindex never removed them). Focus and
      // arrow navigation therefore live on the links.
      let links = rows
        .map((row) => row.querySelector<HTMLAnchorElement>('a[href]'))
        .filter((link): link is HTMLAnchorElement => link !== null)
      if (links.length === 0) return

      // Drop any wrapper tabindex left by an older render so it cannot add a
      // second tab stop per row.
      for (let row of rows) row.removeAttribute('tabindex')

      function moveFocus(target: number) {
        if (target < 0 || target >= links.length) return
        links.forEach((link) => link.setAttribute('tabindex', '-1'))
        links[target]!.setAttribute('tabindex', '0')
        links[target]!.focus()
      }

      // Single tab stop: first row tabbable, the rest skipped (roving tabindex)
      links.forEach((link, i) => link.setAttribute('tabindex', i === 0 ? '0' : '-1'))

      links.forEach((link, idx) => {
        let ac = new AbortController()
        rovingControllers.push(ac)
        link.addEventListener(
          'keydown',
          (e) => {
            switch (e.key) {
              case 'ArrowDown':
              case 'ArrowUp':
              case 'Home':
              case 'End': {
                e.preventDefault()
                moveFocus(nextFocusIndex(links.length, idx, e.key))
                break
              }
              case ' ':
                // Enter activates an anchor natively; Space does not, so mirror
                // the frame navigation to keep activate-on-Space working.
                e.preventDefault()
                let href = link.getAttribute('href')
                if (href && handle.frame) {
                  handle.frame.src = href
                  handle.frame.reload().catch(() => {})
                }
                break
              default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  let labels = links.map(
                    (l) =>
                      ({
                        label:
                          l.querySelector('[data-list-name]')?.textContent ?? l.textContent ?? '',
                      }) as { label: string },
                  )
                  let target = findTypeaheadTarget(labels, idx, e.key)
                  if (target !== -1) {
                    e.preventDefault()
                    moveFocus(target)
                  }
                }
                break
            }
          },
          { signal: ac.signal },
        )
      })
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
