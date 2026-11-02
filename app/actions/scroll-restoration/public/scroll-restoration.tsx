import { clientEntry, Frame, css, navigate, on, type Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import { listItems, panelStyle, rowStyle } from './scroll-fixtures.ts'

/**
 * The frame-served tall collection. Rendered as a blocking `<Frame>` on the
 * list variant of `StoreScrollReproduction` and removed on the detail
 * variant, which is what makes the document shrink during traversal.
 */
export const ScrollRestorationList = clientEntry(
  import.meta.url,
  function ScrollRestorationList(_handle: Handle<{ loadedAt: string }>) {
    return () => (
      <ul
        id="scroll-restoration-list"
        style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}
      >
        {listItems.map((item) => (
          <li key={item} style={rowStyle}>
            List row {item}
          </li>
        ))}
      </ul>
    )
  },
)

/**
 * The top-level client entry that switches between the tall collection and a
 * short detail. Its local state (the hydration counter) must be preserved
 * across list ↔ detail traversal while the scroll position is restored.
 */
export const StoreScrollReproduction = clientEntry(
  import.meta.url,
  function StoreScrollReproduction(handle: Handle<{ variant: 'list' | 'detail' }>) {
    let interactions = 0

    return () => (
      <section id="store-scroll-reproduction">
        <div style={panelStyle}>
          <strong>Top-level client entry</strong>
          <span style={{ marginLeft: 8, opacity: 0.75 }}>
            rendering {handle.props.variant === 'list' ? 'the collection frame' : 'a short detail'}
          </span>
          <button
            type="button"
            mix={[
              css({ marginLeft: 12, cursor: 'pointer' }),
              on('click', () => {
                interactions++
                void handle.update()
              }),
            ]}
          >
            Hydration check: {interactions}
          </button>
        </div>

        {handle.props.variant === 'list' ? (
          // Deliberately blocking (no fallback): this page reproduces upstream
          // traversal scroll restoration, which requires the full-height list
          // to be server-rendered in the initial document. Its frame src always
          // returns HTML, so blocking is safe here.
          <Frame src={routes.scrollRestoration.items.href()} />
        ) : (
          <article
            id="scroll-restoration-detail"
            style={{ minHeight: 1000, padding: 20, background: 'rgba(0,0,0,0.03)' }}
          >
            <h2>Short detail view</h2>
            <p>
              The top-level client entry now renders much less content than the collection. Use the
              browser Back button while this short layout is present.
            </p>
            <button
              type="button"
              id="scroll-restoration-replace-button"
              style={{ marginTop: 16, cursor: 'pointer' }}
              mix={on('click', () => {
                void navigate(
                  routes.scrollRestoration.detail.href(undefined, {
                    searchParams: { replaced: '1' },
                  }),
                  { history: 'replace', resetScroll: false },
                ).catch(() => {
                  // Superseded by another navigation; the runtime owns the abort.
                })
              })}
            >
              Replace the URL without resetting scroll
            </button>
          </article>
        )}
      </section>
    )
  },
)
