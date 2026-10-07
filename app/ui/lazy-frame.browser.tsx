import {
  Frame,
  clientEntry,
  css,
  ref,
  type Handle,
  type RemixNode,
  type Renderable,
} from 'remix/component'

type LazyFrameProps = {
  src: string
  /** Forwarded to `<Frame>` so the mounted frame stays addressable by name. */
  name?: string
  /** Preload margin; defaults to `320px 0px`, mirroring the upstream demo. */
  rootMargin?: string
  /** Shown after the host nears the viewport while the frame request is in flight. */
  fallback?: Renderable
  children?: RemixNode
}

type IntersectionCallback = (entry: IntersectionObserverEntry) => void

type IntersectionObserverPool = {
  callbacks: Map<Element, Set<IntersectionCallback>>
  observer: IntersectionObserver
}

const defaultRootMargin = '320px 0px'

/**
 * Defers mounting a Frame until its host approaches the viewport.
 *
 * The frame is requested once and stays mounted afterwards, so scrolling back
 * never triggers another round trip. Use it for content that starts offscreen or
 * hidden. Frames that are navigation targets (`data-rmx-target`,
 * `handle.frames.get(...)`, sidebar shells) must stay eagerly rendered, because
 * a frame that has not mounted yet cannot be addressed.
 *
 * LazyFrame instances with the same `rootMargin` share one observer, registering
 * their host for its element lifetime (as the upstream lazy-frames demo does).
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
      let stopLoading = observeIntersection(
        node,
        signal,
        (entry) => {
          if (!entry.isIntersecting) return

          stopLoading()
          requested = true
          void handle.update()
        },
        handle.props.rootMargin ?? defaultRootMargin,
      )
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

const intersectionObserverPools = new Map<string, IntersectionObserverPool>()

function observeIntersection(
  node: Element,
  signal: AbortSignal,
  callback: IntersectionCallback,
  rootMargin: string,
): () => void {
  if (signal.aborted) return () => {}

  let pool = intersectionObserverPools.get(rootMargin)
  if (pool === undefined) {
    let callbacks = new Map<Element, Set<IntersectionCallback>>()
    let observer = new IntersectionObserver(
      (entries) => {
        for (let entry of entries) {
          for (let dispatch of callbacks.get(entry.target) ?? []) dispatch(entry)
        }
      },
      { rootMargin },
    )
    pool = { callbacks, observer }
    intersectionObserverPools.set(rootMargin, pool)
  }

  let callbacks = pool.callbacks.get(node)
  if (callbacks === undefined) {
    callbacks = new Set()
    pool.callbacks.set(node, callbacks)
    pool.observer.observe(node)
  }

  function unobserve() {
    signal.removeEventListener('abort', unobserve)

    let currentPool = intersectionObserverPools.get(rootMargin)
    if (currentPool === undefined) return
    let currentCallbacks = currentPool.callbacks.get(node)
    if (currentCallbacks === undefined || !currentCallbacks.delete(callback)) return

    if (currentCallbacks.size === 0) {
      currentPool.callbacks.delete(node)
      currentPool.observer.unobserve(node)
    }

    if (currentPool.callbacks.size === 0) {
      currentPool.observer.disconnect()
      intersectionObserverPools.delete(rootMargin)
    }
  }

  callbacks.add(callback)
  signal.addEventListener('abort', unobserve, { once: true })
  return unobserve
}

/** Runtime mixin on the entry's own host — never serialized, so it is safe. */
const hostStyle = css({
  minHeight: '2.75rem',
})
