import { clientEntry, Frame, on, type Handle, css } from 'remix/component'

import { routes } from '../../../routes.ts'
import { listItems, panelStyle, rowStyle } from './scroll-fixtures.ts'

/**
 * The frame-served tall collection used by the scroll-anchoring reproduction.
 * It carries no interactive state of its own: the preserved entry lives in the
 * parent page, and the browser must keep that entry's local state and scroll
 * anchor across detail traversal.
 */
export const ScrollAnchoringList = clientEntry(
  import.meta.url,
  function ScrollAnchoringList(handle: Handle<{ loadedAt: string }>) {
    return () => (
      <section id="scroll-anchoring-list">
        <p mix={css({ opacity: 0.72 })}>Blocking frame resolved at {handle.props.loadedAt}</p>
        <ol mix={css({ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' })}>
          {listItems.map((item) => (
            <li key={item} mix={rowStyle}>
              Anchoring row {item}
            </li>
          ))}
        </ol>
      </section>
    )
  },
)

/**
 * The preserved collection entry. On the detail page it renders no frame; the
 * detail-only entry is inserted before it, which is the anchoring setup.
 */
export const ScrollAnchoringReproduction = clientEntry(
  import.meta.url,
  function ScrollAnchoringReproduction(handle: Handle<{ variant: 'list' | 'detail' }>) {
    let interactions = 0

    return () => (
      <section id="scroll-anchoring-reproduction">
        <div mix={panelStyle}>
          <strong>Preserved collection client entry</strong>
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
          <Frame src={routes.scrollRestoration.anchoringItems.href()} />
        ) : null}
      </section>
    )
  },
)

/** The detail-only entry that is inserted before the preserved collection entry. */
export const ScrollAnchoringDetail = clientEntry(import.meta.url, function ScrollAnchoringDetail() {
  return () => (
    <article
      id="scroll-anchoring-detail"
      mix={css({
        minHeight: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 20,
        background: 'rgba(0,0,0,0.03)',
        borderRadius: 10,
      })}
    >
      <div>
        <h2>Scroll anchoring detail</h2>
        <p>
          This detail-only client entry is inserted before the preserved collection entry. Use the
          browser Back button to return to the list.
        </p>
      </div>
      <p mix={css({ marginBottom: 0 })}>Use the browser Back button now.</p>
    </article>
  )
})
