import { clientEntry, type Handle } from 'remix/component'

/**
 * The app scrolls inside the shared page container (main > div, marked with
 * data-page-scroller), not the document. The frame runtime's default scroll
 * reset runs the Navigation API's event.scroll(), which only scrolls the
 * document, so a nested frame navigation (pagination, sort, filter) kept the
 * old container offset. When the destination page is shorter the browser
 * clamps that offset; with variable row heights the clamp lands unpredictably,
 * which reads as the page jumping.
 *
 * Reset the app scroller after each same-document navigation, matching the
 * framework's after-transition default. A link/form that sets
 * data-rmx-reset-scroll="manual" (alias "false") opts out. SSE frame reloads
 * (handle.frame.reload()) are not Navigation API navigations and stay
 * unaffected, so a live grid does not yank the reader to the top.
 */

type NavigateEventLike = {
  navigationType: string
  sourceElement?: Element | null
}

type NavigationLike = {
  addEventListener(
    type: 'navigate',
    listener: (event: NavigateEventLike) => void,
    options?: { signal?: AbortSignal },
  ): void
  addEventListener(
    type: 'navigatesuccess',
    listener: () => void,
    options?: { signal?: AbortSignal },
  ): void
}

function navigationApi(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation
}

function resetScrollContainers(): void {
  for (let scroller of document.querySelectorAll<HTMLElement>(
    '[data-page-scroller], [data-grid-scroll]',
  )) {
    scroller.scrollTo({ top: 0, behavior: 'auto' })
  }
}

export const PageScrollReset = clientEntry(
  import.meta.url + '#PageScrollReset',
  function PageScrollResetEntry(handle: Handle) {
    let installed = false

    return () => {
      handle.queueTask(() => {
        if (installed) return
        let navigation = navigationApi()
        if (!navigation) return
        installed = true

        let pendingReset = false

        navigation.addEventListener(
          'navigate',
          (event) => {
            if (event.navigationType !== 'push' && event.navigationType !== 'replace') {
              pendingReset = false
              return
            }
            let optOut = event.sourceElement?.getAttribute('data-rmx-reset-scroll')
            pendingReset = optOut !== 'manual' && optOut !== 'false'
          },
          { signal: handle.signal },
        )

        navigation.addEventListener(
          'navigatesuccess',
          () => {
            if (!pendingReset) return
            pendingReset = false
            // The appointment create/delete panel manages its own scroll
            // (CreatePanelScrollLive) so a step change keeps the panel header
            // visible on mobile; leave that page's scroll alone.
            if (document.querySelector('[data-create-panel]')) return
            resetScrollContainers()
          },
          { signal: handle.signal },
        )
      })

      return null
    }
  },
)
