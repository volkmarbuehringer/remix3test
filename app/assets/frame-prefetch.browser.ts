import type { PrefetchOptions } from 'remix/component'

import { prefetchFrameResponse } from './frame-response.browser.tsx'

/**
 * One-shot cache for frame HTML warmed by `data-rmx-prefetch` / `prefetch()`.
 *
 * The app's resolver replaces the runtime default (agent prefill, error cards, in-frame
 * redirect reconciliation), so the default prefetcher's HTML can never be reused: it
 * fetches with its own request and the navigation fetches again. Warming through
 * `prefetchFrameResponse` stores the same response the navigation would have fetched, so
 * an intent turns the follow-up click into a cache hit instead of a second SSR.
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
// The settled warm is kept as a promise, so a navigation that runs while it is still in
// flight can await it instead of issuing a second request for the same fragment.
const inFlight = new Map<string, Promise<void>>()

// Bumped whenever the warmed set is invalidated, so a prefetch that was already in flight
// cannot repopulate the cache after a navigation it predates.
let generation = 0

function cacheKey(url: URL, target?: string): string {
  return (target ?? '') + ' ' + url.href
}

/** Starts warming the frame response that a later navigation to `src` would render. */
export function prefetchFrame(src: string, options?: PrefetchOptions): void {
  let url: URL
  try {
    url = new URL(src, window.location.href)
  } catch {
    return
  }
  if (url.origin !== window.location.origin) return

  let key = cacheKey(url, options?.target)
  if (frames.has(key) || inFlight.has(key)) return

  let startedIn = generation
  let warm = prefetchFrameResponse(url, options)
    .then((response) => {
      if (response && generation === startedIn) storePrefetchedFrame(key, response)
    })
    .catch(() => {
      // A failed prefetch is a no-op; the navigation fetches again.
    })
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, warm)
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
