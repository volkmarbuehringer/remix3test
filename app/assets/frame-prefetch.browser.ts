import { defaultPrefetch } from 'remix/component'
import type { PrefetchFrameOptions } from 'remix/component'

import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import {
  frameFragmentBaseUrl,
  prefetchFrameAssetElements,
  prefetchFrameAssets,
} from './frame-asset-prefetch.browser.ts'
import { classifyFrameResponse, encodeAgentPrefill } from './frame-response.browser.tsx'

/**
 * One-shot cache for frame HTML warmed by `data-rmx-prefetch` / `prefetch()`.
 *
 * The app's resolver replaces the runtime default (agent prefill, error cards, in-frame
 * redirect reconciliation), so the default prefetcher's HTML can never be reused: it
 * fetches with its own request and the navigation fetches again. Warming through
 * `prefetchFrame` stores the same response the navigation would have fetched, so an
 * intent turns the follow-up click into a cache hit instead of a second SSR.
 *
 * Since #12277 the off-the-shelf strategy is extensible, so the hook delegates to
 * `defaultPrefetch(src, options, { fetch, processFrame })`:
 *
 * - `fetch` keeps the app-only request policy (`X-Agent-Prefill`, `cache: 'no-store'`)
 *   and stores a clone of every response a real navigation would render. The vendor
 *   parser consumes the original.
 * - `processFrame` feeds the vendor's already-parsed fragment into the app-owned asset
 *   hint creator, so the HTML is not parsed twice. The app keeps the hint rules the
 *   vendor does not encode (document dedupe, WebKit `rel=prefetch` gating, stale-hint
 *   re-creation) — see `frame-asset-prefetch.browser.ts`.
 *
 * Entries are single use and short lived. Frame HTML carries the CSP nonce of the response
 * that rendered it, so a warmed fragment is only reusable inside the document that asked
 * for it; the app's frames carry inert JSON scripts and runtime-appended import maps
 * (re-nonced from the installed map), which is why a short-lived reuse stays valid.
 */

const PREFETCH_TTL_MS = 10_000
const PREFETCH_MAX_ENTRIES = 8

interface PrefetchedFrame {
  response: Response
  storedAt: number
}

const frames = new Map<string, PrefetchedFrame>()
// Resolves as soon as the response is stored (or the warm is refused/fails), so a
// navigation that runs while the warm is still in flight can await the store without
// waiting for the vendor's idle parse and asset discovery.
const inFlight = new Map<string, Promise<void>>()

// Bumped whenever the warmed set is invalidated, so a prefetch that was already in flight
// cannot repopulate the cache after a navigation it predates.
let generation = 0

function cacheKey(url: URL, target?: string): string {
  // Match the vendor request URL: relative sources resolve against the document base
  // and fragments are not part of the request (a hash-only navigation never reloads).
  let normalized = new URL(url.href)
  normalized.hash = ''
  return (target ?? '') + ' ' + normalized.href
}

/**
 * Starts warming the frame response that a later navigation to `src` would render.
 *
 * Delegates to `defaultPrefetch`, which owns request sharing, cancellation when every
 * caller is gone, idle-deferred parsing, and nested-frame discovery. The app keeps the
 * cache key, TTL, single-use invalidation, and the prefill header.
 */
export function prefetchFrame(src: string, options?: PrefetchFrameOptions): void {
  let url: URL
  try {
    url = new URL(src, window.location.href)
  } catch {
    return
  }
  if (url.origin !== window.location.origin) return
  // A caller that already lost interest cannot be followed by a navigation to this URL.
  if (options?.signal?.aborted) return

  let key = cacheKey(url, options?.target)
  if (frames.has(key) || inFlight.has(key)) return

  let startedIn = generation
  let callerSignal = options?.signal
  let { promise: stored, resolve: markStored } = Promise.withResolvers<void>()
  inFlight.set(key, stored)

  // Keys of responses this warm actually cached; asset hints only run for those, so a
  // redirect/login bounce does not warm the destination's assets.
  let cached = new Set<string>()

  void defaultPrefetch(src, options, {
    async fetch(preparedUrl, init) {
      let requestUrl = new URL(preparedUrl)
      let target = new Headers(init.headers).get('X-Remix-Target') ?? undefined
      let requestKey = cacheKey(requestUrl, target)

      let prefillKey = requestUrl.pathname + requestUrl.search
      let prefill = agentPrefillMap.get(prefillKey)
      let headers = new Headers(init.headers)
      if (prefill) headers.set('X-Agent-Prefill', encodeAgentPrefill(prefill))

      let requestInit: RequestInit = { ...init, headers, cache: 'no-store' }
      // Do not forward the shared request signal: the navigation claims the stored
      // response *before* the runtime removes the anchor that started this warm, so a
      // cancel would error the cached body while the frame is still reading it (remix
      // #12277 per-caller signal regression; see the learned prefetch reference). The
      // caller's own signal still gates caching below.
      delete requestInit.signal

      let response = await fetch(preparedUrl, requestInit)

      if (
        generation === startedIn &&
        !callerSignal?.aborted &&
        classifyFrameResponse(response, { target, mode: 'prefetch' }).kind === 'render'
      ) {
        let copy = cacheCopy(response)
        if (copy) {
          storePrefetchedFrame(requestKey, copy)
          cached.add(requestKey)
          if (!response.ok) {
            // `defaultPrefetch` only parses `ok` HTML, but a 4xx validation fragment is
            // still a real navigation target. Keep warming its assets like the previous
            // app-owned warmer did (rare path; the fragment is parsed once more).
            void prefetchFrameAssets(copy, requestUrl)
          }
        }
      }

      markStored()
      if (inFlight.get(key) === stored) inFlight.delete(key)
      return response
    },
    processFrame(_prefetchReferences, context) {
      let requestKey = cacheKey(new URL(context.src, document.baseURI), context.target)
      if (!cached.has(requestKey)) return
      void prefetchFrameAssetElements(
        context.assets,
        frameFragmentBaseUrl(context.fragment, context.response.url || context.src),
      )
    },
  })
    .catch(() => {
      // A failed prefetch is a no-op; the navigation fetches again.
    })
    .finally(() => {
      if (inFlight.get(key) === stored) inFlight.delete(key)
      // A fetch failure or an all-caller cancellation never reaches the store, so release
      // a waiting navigation instead of leaving it parked on a promise that cannot settle.
      markStored()
    })
}

/**
 * Claims a warmed response for a real navigation. Single use: consuming one entry drops the
 * rest, because that navigation may have changed the data behind them.
 */
export function takePrefetchedFrame(url: URL, target?: string): Response | undefined {
  let key = cacheKey(url, target)
  let entry = frames.get(key)
  if (!entry) return undefined
  frames.delete(key)
  if (Date.now() - entry.storedAt > PREFETCH_TTL_MS) return undefined
  // Consuming a frame means a navigation happened, so everything else is suspect.
  clearPrefetchedFrames()
  return entry.response
}

/**
 * Claims a warmed response for a navigation, waiting for a warm that is still in flight
 * instead of fetching the same fragment twice.
 *
 * The runtime starts the prefetch on `pointerdown`, so a fast click races it: without this
 * wait the resolver would find no stored entry, discard the in-flight warm through the
 * generation bump, and start a second SSR for the same URL.
 */
export async function claimPrefetchedFrame(
  url: URL,
  target?: string,
  signal?: AbortSignal,
): Promise<Response | undefined> {
  let stored = takePrefetchedFrame(url, target)
  if (stored) return stored

  let warm = inFlight.get(cacheKey(url, target))
  if (!warm) return undefined

  await abortable(warm, signal)
  return takePrefetchedFrame(url, target)
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason)

  return new Promise<T>((resolve, reject) => {
    let onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

/** Drops warmed responses after a navigation, including prefetches still in flight. */
export function clearPrefetchedFrames(): void {
  generation += 1
  frames.clear()
}

function storePrefetchedFrame(key: string, response: Response): void {
  frames.delete(key)
  frames.set(key, { response, storedAt: Date.now() })
  while (frames.size > PREFETCH_MAX_ENTRIES) {
    let oldest = frames.keys().next()
    if (oldest.done) break
    frames.delete(oldest.value)
  }
}

/**
 * The vendor parser consumes the returned response, so the cache keeps a clone and the
 * original streams into the parser. A response stub without `clone` (browser tests) is
 * stored as-is, matching the pre-#12277 cache contract.
 */
function cacheCopy(response: Response): Response | undefined {
  try {
    return typeof response.clone === 'function' ? response.clone() : response
  } catch {
    return undefined
  }
}
