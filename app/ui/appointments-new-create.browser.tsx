import { clientEntry, type Handle } from 'remix/ui'

// The create/delete panel can load scrolled past its header: a frame navigation
// can carry a stale scroll offset into the new step, and the sticky column only
// sticks while its content is shorter than the grid row. On mobile the panel is
// stacked below the list, so it is off-screen entirely. Either way, reset the
// view on each step change so the user lands on the panel header and step
// context instead of somewhere in the middle of the form.
function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node) {
    let overflowY = getComputedStyle(node).overflowY
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

function revealPanel(panel: HTMLElement): void {
  if (window.matchMedia('(max-width: 768px)').matches) {
    // Stacked layout: the panel is below the list, so scroll it into view.
    panel.style.scrollMarginTop = '4.5rem'
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  // Desktop: the panel already sits at the top of its column, so a stale scroll
  // offset that pushed its header above the fold is fixed by returning to the
  // top of the page (which also restores the section heading).
  if (panel.getBoundingClientRect().top >= 0) return
  let scroller = findScrollParent(panel)
  if (scroller) {
    scroller.scrollTo({ top: 0, behavior: 'auto' })
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
}

export const CreatePanelScrollLive = clientEntry(
  import.meta.url + '#CreatePanelScrollLive',
  function CreatePanelScrollLiveEntry(handle: Handle) {
    // The factory closure survives frame DOM swaps, so compare the panel's
    // navigation key to reveal exactly once per step change rather than on
    // every re-render (which would fight the user's own scrolling).
    let lastKey: string | null = null

    return () => {
      if (typeof document === 'undefined') return null
      let panel = document.querySelector<HTMLElement>('[data-create-panel]')
      if (!panel) return null

      let key = panel.getAttribute('data-panel-step') ?? 'panel'
      if (key !== lastKey) {
        lastKey = key
        handle.queueTask(() => {
          let current = document.querySelector<HTMLElement>('[data-create-panel]')
          if (current && (current.getAttribute('data-panel-step') ?? 'panel') === key) {
            revealPanel(current)
          }
        })
      }
      return null
    }
  },
)
