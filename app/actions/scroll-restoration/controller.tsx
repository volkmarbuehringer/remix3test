import { createController } from 'remix/router'

import { Document } from '../../ui/document.tsx'
import { routes } from '../../routes.ts'
import { ScrollRestorationList, StoreScrollReproduction } from './public/scroll-restoration.tsx'

/**
 * Frame traversal scroll-restoration reproduction.
 *
 * Mirrors the upstream Remix demo: a top-level client entry
 * (`StoreScrollReproduction`) switches between a tall collection rendered by a
 * blocking `<Frame>` and a short detail layout. Navigating with the browser
 * Back button must restore the previous scroll position even though the
 * client-entry reconciliation shrinks the document.
 *
 * Routes:
 *   /scroll-restoration                      → list variant (tall, frame)
 *   /scroll-restoration/detail               → short detail variant
 *   /scroll-restoration/frames/scroll-restoration-items → frame list content
 */
export default createController(routes.scrollRestoration, {
  actions: {
    index(context) {
      return context.render(
        <Document title="Navigation scroll behavior">
          <a href={routes.home.href()}>← Back to home</a>
          <h1>Navigation scroll behavior</h1>
          <p>
            A top-level client entry switches between a short detail and a tall collection rendered
            by a frame. Scroll down, open the detail page, then use the browser Back button — the
            collection scroll position should be restored.
          </p>

          <StoreScrollReproduction variant="list" />

          <section id="scroll-restoration-list-end">
            <h2>End of the list</h2>
            <p>
              Note <code>window.scrollY</code>, open the detail page, and return with the browser
              Back button.
            </p>
            <a id="scroll-restoration-detail-link" href={routes.scrollRestoration.detail.href()}>
              Open the shorter detail page →
            </a>
          </section>
        </Document>,
      )
    },

    detail(context) {
      return context.render(
        <Document title="Navigation scroll behavior">
          <a href={routes.home.href()}>← Back to home</a>
          <h1>Navigation scroll behavior</h1>
          <p>
            The top-level client entry now renders much less content than the collection. Use the
            browser Back button while this short layout is present.
          </p>

          <StoreScrollReproduction variant="detail" />
        </Document>,
      )
    },

    items(context) {
      return context.render(<ScrollRestorationList loadedAt={new Date().toLocaleTimeString()} />)
    },
  },
})
