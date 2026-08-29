import { clientEntry, Frame, css, on, type Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'

const listItems = Array.from({ length: 48 }, (_, index) => index + 1)

const rowStyle = {
  minHeight: 76,
  display: 'flex',
  alignItems: 'center',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 10,
  padding: '0 18px',
  background: 'rgba(0,0,0,0.03)',
}

const panelStyle = {
  position: 'sticky',
  top: 12,
  zIndex: 1,
  padding: 14,
  marginBottom: 12,
  background: '#151c35',
  color: '#ffffff',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
}

/**
 * The frame-served tall collection. Rendered as a blocking `<Frame>` on the
 * list variant of `StoreScrollReproduction` and removed on the detail
 * variant, which is what makes the document shrink during traversal.
 */
export const ScrollRestorationList = clientEntry(
  import.meta.url,
  function ScrollRestorationList(handle: Handle<{ loadedAt: string }>) {
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
                handle.update()
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
          </article>
        )}
      </section>
    )
  },
)
