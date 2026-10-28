import { clientEntry, css, type Handle } from 'remix/component'

/**
 * Announces the result summary of an admin grid after a frame navigation.
 *
 * The grid footer ([data-pagination-info]) carries the range/total, but a frame
 * navigation replaces its whole content. A live region inside the swapped
 * fragment is a brand-new node, so screen readers do not announce its initial
 * content. This entry lives in the document shell (outside every content frame)
 * and mirrors the footer text into a persistent polite status region whenever
 * it changes.
 *
 * A MutationObserver is used instead of frame events because the grids are not
 * named here: any [data-pagination-info] insertion or text update is picked up,
 * and the observer survives every frame swap with the shell.
 */
const srOnlyStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
})

export const GridStatusAnnouncer = clientEntry(
  import.meta.url + '#GridStatusAnnouncer',
  function GridStatusAnnouncer(handle: Handle) {
    if (typeof document !== 'undefined') {
      let lastAnnounced = ''
      let scheduled = false

      function announce(): void {
        let region = document.querySelector<HTMLElement>('[data-grid-status]')
        if (!region) return
        let info = document.querySelector<HTMLElement>('[data-pagination-info]')
        let text = info?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        if (!text || text === lastAnnounced) return
        lastAnnounced = text
        region.textContent = text
      }

      function schedule(): void {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          announce()
        })
      }

      /**
       * Only mutations on or around the footer can change the announcement;
       * typing in the compose box and chat-stream rows must stay free of the
       * query work this observer would otherwise schedule on every keystroke.
       */
      function isPaginationMutation(mutation: MutationRecord): boolean {
        let target = mutation.target
        if (target instanceof Element && target.closest('[data-pagination-info]')) return true
        if (target.parentElement?.closest('[data-pagination-info]')) return true
        for (let node of [...mutation.addedNodes, ...mutation.removedNodes]) {
          if (
            node instanceof Element &&
            (node.matches('[data-pagination-info]') || node.querySelector('[data-pagination-info]'))
          ) {
            return true
          }
        }
        return false
      }

      function onMutations(mutations: MutationRecord[]): void {
        if (mutations.some(isPaginationMutation)) schedule()
      }

      let target = document.querySelector<HTMLElement>('[data-page-scroller]') ?? document.body
      let observer = new MutationObserver(onMutations)
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      })
      handle.signal.addEventListener('abort', () => observer.disconnect())
    }

    return () => (
      <div data-grid-status role="status" aria-live="polite" aria-atomic="true" mix={srOnlyStyle} />
    )
  },
)
