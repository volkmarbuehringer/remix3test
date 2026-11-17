import { clientEntry, css, type Handle } from 'remix/component'

/**
 * Announces the one-shot success flash from a live region that outlives the
 * swapped content.
 *
 * The error banner renders with `role="alert"` and is announced when it is
 * inserted (frame swap) or parsed (PRG document load). A success banner cannot
 * rely on that: `role="status"` introduced by a frame swap is a brand-new live
 * region, and screen readers do not announce content that appears together with
 * a live region. This entry lives in the document shell — outside every frame —
 * and mirrors each success banner into a persistent `role="status"` region, the
 * same pattern `GridStatusAnnouncer` uses for the grid footer.
 *
 * The initial scan also announces a success flash that was already server-
 * rendered when the entry hydrates (a PRG destination document load).
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

export const FlashAnnouncer = clientEntry(
  import.meta.url + '#FlashAnnouncer',
  function FlashAnnouncer(handle: Handle) {
    // Schedule browser-only setup after the client commit (guide 05
    // §"DOM references, global events, and cleanup"): setup also runs during
    // SSR, and the queued task is a no-op there.
    handle.queueTask(() => {
      // Per-banner text: a later navigation can reuse the same element, and a
      // repeated message in a new banner must still be announced.
      let announced = new WeakMap<Element, string>()
      let scheduled = false

      function announce(): void {
        let region = document.querySelector<HTMLElement>('[data-flash-status]')
        if (!region) return
        let messages: string[] = []
        for (let banner of document.querySelectorAll<HTMLElement>('[data-flash-banner]')) {
          if (banner.getAttribute('data-flash-tone') !== 'success') continue
          let text = (banner.textContent ?? '').replace(/\s+/g, ' ').trim()
          if (!text || announced.get(banner) === text) continue
          announced.set(banner, text)
          messages.push(text)
        }
        if (messages.length > 0) region.textContent = messages.join(' ')
      }

      function schedule(): void {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          announce()
        })
      }

      /** Only banner insertions/text changes matter; keystrokes must stay cheap. */
      function isFlashMutation(mutation: MutationRecord): boolean {
        if (mutation.type === 'characterData') {
          return mutation.target.parentElement?.closest('[data-flash-banner]') != null
        }
        let target = mutation.target
        if (target instanceof Element && target.closest('[data-flash-banner]')) return true
        for (let node of [...mutation.addedNodes, ...mutation.removedNodes]) {
          if (!(node instanceof Element)) continue
          if (
            node.matches('[data-flash-banner]') ||
            node.querySelector('[data-flash-banner]') != null
          ) {
            return true
          }
        }
        return false
      }

      let observer = new MutationObserver((mutations) => {
        if (mutations.some(isFlashMutation)) schedule()
      })
      // Content frames render inside the page scroller; scoping the observer
      // there keeps streaming-chat and typing mutations out of this path (the
      // same reason GridStatusAnnouncer scopes its observer). The initial scan
      // below still catches a document `Layout` banner outside the scroller.
      let target = document.querySelector<HTMLElement>('[data-page-scroller]') ?? document.body
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      })
      handle.signal.addEventListener('abort', () => observer.disconnect())

      // A PRG destination that was server-rendered before hydration.
      announce()
    })

    return () => (
      <div
        data-flash-status=""
        role="status"
        aria-live="polite"
        aria-atomic="true"
        mix={srOnlyStyle}
      />
    )
  },
)
