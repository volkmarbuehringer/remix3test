import {
  Frame,
  clientEntry,
  css,
  ref,
  type Handle,
  type RemixNode,
  type Renderable,
} from 'remix/ui'

export type LazyFrameProps = {
  src: string
  /** Forwarded to `<Frame>` so the mounted frame stays addressable by name. */
  name?: string
  /** Preload margin; defaults to `320px 0px`, mirroring the upstream demo. */
  rootMargin?: string
  /** Shown after the host nears the viewport while the frame request is in flight. */
  fallback?: Renderable
  children?: RemixNode
}

/**
 * Defers mounting a Frame until its host approaches the viewport.
 *
 * The frame is requested once and stays mounted afterwards, so scrolling back
 * never triggers another round trip. Use it for content that starts offscreen or
 * hidden. Frames that are navigation targets (`data-rmx-target`,
 * `handle.frames.get(...)`, sidebar shells) must stay eagerly rendered, because
 * a frame that has not mounted yet cannot be addressed.
 *
 * Two app-specific constraints, both verified against the pinned runtime:
 *
 * - `children` and `fallback` cross the client-entry boundary by serialization.
 *   An element carrying a `css()` mixin loses its descriptor's function `type`
 *   there (it serializes to `{ args: [...] }`), and hydration then fails with
 *   `Framework invariant: Invalid mix prop` — which replaces the whole document
 *   with the error card. Pass plain text or mixin-free elements and style them
 *   from the server-rendered shell, as the upstream demo does.
 * - The host needs a non-zero box for `IntersectionObserver` to report it once
 *   it becomes visible (a closed `<details>` is not rendered). Plain text
 *   children give it height; `minHeight` only guards the empty case.
 */
export const LazyFrame = clientEntry(
  import.meta.url + '#LazyFrame',
  function LazyFrameEntry(handle: Handle<LazyFrameProps>) {
    let requested = false

    let observe = ref((node, signal) => {
      let observer = new IntersectionObserver(
        (entries) => {
          if (requested || signal.aborted || !entries.some((entry) => entry.isIntersecting)) return

          requested = true
          observer.disconnect()
          handle.update()
        },
        { rootMargin: handle.props.rootMargin ?? '320px 0px' },
      )

      observer.observe(node)
      signal.addEventListener('abort', () => observer.disconnect(), { once: true })
    })

    return () => (
      <div mix={[observe, hostStyle]}>
        {requested ? (
          <Frame
            src={handle.props.src}
            fallback={handle.props.fallback}
            // `exactOptionalPropertyTypes` forbids passing `string | undefined`
            // into the vendor `name?: string`, so only spread it when set.
            {...(handle.props.name !== undefined ? { name: handle.props.name } : {})}
          />
        ) : (
          handle.props.children
        )}
      </div>
    )
  },
)

/** Runtime mixin on the entry's own host — never serialized, so it is safe. */
const hostStyle = css({
  minHeight: '2.75rem',
})
