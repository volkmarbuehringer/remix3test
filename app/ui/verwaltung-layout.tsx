import type { RemixNode } from 'remix/component'
import { css } from 'remix/component'
import { currentRequestTargetsFrame } from '../utils/frame-target.ts'

import { Layout } from './layout.tsx'
import { FlashBanner } from './flash-banner.tsx'
import { frames } from '../routes.ts'
import { VerwaltungNav } from './verwaltung-nav.tsx'

const FRAME_TARGETS = new Set([
  frames.adminContent,
  frames.listsContent,
  // Nested agent panel frames load verwaltung pages as content-only fragments —
  // without these, a verwaltung page rendered inside an agent panel would emit a
  // full <Layout> shell, and its own form/link navigations would target the outer
  // admin-content frame, tearing down the host agent page.
  frames.agentEventsPanel,
])

interface VerwaltungRenderOptions {
  /** Document title for full-page responses. Frame fragments have no document. */
  title?: string | undefined
  init?: ResponseInit | undefined
  /**
   * Fill the bounded page area and let the grid's row region scroll instead of
   * the page. Used by the Verwaltung data grids so a 15-row page does not
   * produce a page scrollbar. Ignored on frame fragments, which have their own
   * host layout.
   */
  fullHeight?: boolean | undefined
}

/**
 * Bounded fill shell for the Verwaltung grids. `height: 100%` resolves against
 * the page scroll container's content box; the tab nav stays fixed and the
 * page's `<section>` takes the rest, so the page itself never overflows.
 */
const fullHeightShellStyle = css({
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  '& > section': { flex: 1, minHeight: 0 },
})

export function renderVerwaltungPage(
  render: (node: RemixNode, init?: ResponseInit) => Response,
  content: RemixNode,
  options: VerwaltungRenderOptions = {},
) {
  let { title, init, fullHeight } = options
  let isFrame = currentRequestTargetsFrame(...FRAME_TARGETS)

  if (isFrame) {
    // The full-document path shows the PRG flash via Layout; the fragment path
    // renders it here so a message is surfaced by exactly one of them.
    return render(
      <>
        <FlashBanner compact />
        {content}
      </>,
      init,
    )
  }
  if (fullHeight) {
    return render(
      <Layout title={title}>
        <div mix={fullHeightShellStyle}>
          <VerwaltungNav />
          {content}
        </div>
      </Layout>,
      init,
    )
  }

  return render(
    <Layout title={title}>
      <VerwaltungNav />
      {content}
    </Layout>,
    init,
  )
}
