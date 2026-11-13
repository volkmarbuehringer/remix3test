/**
 * Destination asset discovery for warmed frame HTML.
 *
 * `run({ prefetch })` delegates to `defaultPrefetch`, which parses the warmed HTML
 * inertly and exposes the supported declarations as `context.assets`. This module turns
 * those elements into `<link rel="prefetch">` hints for the destination's JavaScript,
 * CSS, and declared image/font preloads. Without it the app warms the HTML but still
 * pays for every destination asset only when the navigation starts.
 *
 * The vendor's own `prefetchReferences()` is deliberately not delegated: its hints live
 * in the internal `pendingPrefetchLinks` set, while this module keeps the app rules that
 * are load-bearing here (a hint dropped by a head diff is re-created instead of
 * suppressing the asset forever; WebKit's missing `rel=prefetch` support is a no-op).
 * `processFrame` passes the vendor's already-parsed `assets`, so production parses the
 * HTML once; `prefetchFrameAssets(response, sourceUrl)` is the standalone
 * response-based entry used by tests.
 *
 * Discovery rules:
 *
 * - `link[href]`, `script[src]`, and nested `<template>` content
 * - honor a `<base href>` in the response
 * - skip assets the current document already has
 * - keep one hint per asset (`href` + `as` + `crossorigin` + `integrity` +
 *   `referrerpolicy`), and remove it on load/error
 *
 * Hints are independent of the one-shot HTML cache: a navigation invalidates warmed
 * HTML, but a destination asset (a client-entry module or stylesheet) stays useful.
 * Prefetches never execute the HTML or its scripts.
 */

type PendingAsset = {
  link: HTMLLinkElement
  promise: Promise<void>
  timer: ReturnType<typeof setTimeout> | undefined
}

const pendingAssets = new Map<string, PendingAsset>()

/**
 * Starts asset discovery for a response that was just warmed for a frame navigation.
 *
 * Returns the discovery promise so tests can wait for the HTML to be parsed and
 * the hints to settle; navigation callers may ignore it.
 *
 * Production warming uses {@link prefetchFrameAssetElements} with the vendor
 * prefetcher's already-parsed fragment (`defaultPrefetch`'s `processFrame`), so the
 * HTML is not parsed twice. This response-based entry remains the standalone path
 * (tests and any caller holding only a `Response`).
 */
export function prefetchFrameAssets(response: Response, sourceUrl: URL): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()

  // A JSON/plain-text error body is never a frame fragment; nothing to discover.
  // Match the vendor default: require an explicit HTML content type rather than
  // guessing from a header-less binary response.
  let contentType = response.headers?.get?.('Content-Type')
  if (contentType == null || !contentType.toLowerCase().includes('text/html')) {
    return Promise.resolve()
  }

  let clone: Response
  try {
    clone = response.clone()
  } catch {
    // A partial/stubbed response (tests) or a locked body cannot be inspected.
    return Promise.resolve()
  }
  if (typeof clone.text !== 'function') return Promise.resolve()

  return clone
    .text()
    .then(async (html) => {
      if (!html) return
      let template = document.createElement('template')
      template.innerHTML = html
      let baseUrl = frameFragmentBaseUrl(template.content, clone.url || sourceUrl.href)
      await prefetchFrameAssetElements(collectElements(template.content), baseUrl)
    })
    .catch(() => {
      // Discovery is speculative; the navigation still fetches its own assets.
    })
}

/**
 * Resolves the base URL of a parsed frame fragment: the response URL, or its first
 * `<base href>`. Mirrors the vendor's `defaultPrefetch` base handling.
 */
export function frameFragmentBaseUrl(fragment: ParentNode, responseUrl: string): string {
  let base = fragment.querySelector('base[href]')?.getAttribute('href')
  if (base != null) {
    try {
      return new URL(base, responseUrl).href
    } catch {
      // An invalid base falls back to the response URL, as it would in a document.
    }
  }
  return responseUrl
}

/**
 * Emits low-priority `<link rel="prefetch">` hints for asset elements discovered in a
 * frame fragment. The vendor `defaultPrefetch` already parsed the HTML and filtered
 * the supported declarations, so production passes its `context.assets` here.
 */
export function prefetchFrameAssetElements(
  elements: readonly Element[],
  baseUrl: string,
): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()

  let activeAssets = collectActiveAssets()
  let requests: Promise<void>[] = []
  for (let element of elements) {
    let link = createAssetPrefetch(element, baseUrl)
    if (link) requests.push(prefetchAsset(link, activeAssets))
  }
  return Promise.all(requests).then(() => {})
}

/** Drops hints that have not settled yet. Used by browser tests; navigation leaves them. */
export function clearPrefetchedAssets(): void {
  for (let { link, timer } of pendingAssets.values()) {
    if (timer !== undefined) clearTimeout(timer)
    link.remove()
  }
  pendingAssets.clear()
}

function collectElements(container: ParentNode): Element[] {
  let elements: Element[] = []
  for (let element of container.querySelectorAll('link[href], script[src], template')) {
    if (element.tagName === 'TEMPLATE') {
      let content = (element as HTMLTemplateElement).content
      if (content) elements.push(...collectElements(content))
      continue
    }
    elements.push(element)
  }
  return elements
}

function collectActiveAssets(): Set<string> {
  let keys = new Set<string>()
  try {
    for (let element of document.querySelectorAll('link[href], script[src]')) {
      let link = createAssetPrefetch(element, document.baseURI)
      if (link) keys.add(assetKey(link))
    }
  } catch {
    // An unavailable DOM means there is nothing to dedupe against.
  }
  return keys
}

function createAssetPrefetch(element: Element, baseUrl: string): HTMLLinkElement | undefined {
  if (element instanceof HTMLLinkElement) {
    if (
      !element.relList.contains('modulepreload') &&
      !element.relList.contains('stylesheet') &&
      !(
        element.relList.contains('preload') &&
        ['script', 'style', 'image', 'font'].includes(element.as)
      )
    ) {
      return undefined
    }
    // Prefetch hints cannot select a responsive candidate from imagesrcset.
    if (element.as === 'image' && element.imageSrcset) return undefined
    if (
      ['image', 'font'].includes(element.as) &&
      element.media &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia(element.media).matches
    ) {
      return undefined
    }
  } else if (element instanceof HTMLScriptElement) {
    if (
      !['', 'module', 'text/javascript', 'application/javascript'].includes(
        element.type.toLowerCase(),
      )
    ) {
      return undefined
    }
  } else {
    return undefined
  }

  let href = element.getAttribute(element instanceof HTMLScriptElement ? 'src' : 'href')
  if (!href) return undefined

  let url: URL
  try {
    url = new URL(href, baseUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

  let isModule =
    element instanceof HTMLScriptElement
      ? element.type.toLowerCase() === 'module'
      : element.relList.contains('modulepreload')

  let link = document.createElement('link')
  // Ordinary prefetches don't evaluate modules or resolve their imports in the current import map.
  link.rel = 'prefetch'
  link.fetchPriority = 'low'
  link.as = 'script'
  if (element instanceof HTMLLinkElement && !isModule) {
    link.as = element.relList.contains('stylesheet') ? 'style' : element.as
  }
  link.href = url.href
  for (let name of ['integrity', 'referrerpolicy']) {
    let value = element.getAttribute(name)
    if (value !== null) link.setAttribute(name, value)
  }
  if (isModule || element.hasAttribute('crossorigin')) {
    link.crossOrigin =
      element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials'
        ? 'use-credentials'
        : 'anonymous'
  }
  return link
}

function prefetchAsset(link: HTMLLinkElement, activeAssets: Set<string>): Promise<void> {
  let key = assetKey(link)
  if (activeAssets.has(key)) return Promise.resolve()

  let existing = pendingAssets.get(key)
  if (existing) {
    if (existing.link.isConnected) return existing.promise
    // A head reconciliation can drop a managed hint without firing load/error.
    // Treat a disconnected entry as stale instead of suppressing this asset for
    // the rest of the document's lifetime.
    if (existing.timer !== undefined) clearTimeout(existing.timer)
    pendingAssets.delete(key)
  }

  if (typeof link.relList?.supports !== 'function' || !link.relList.supports('prefetch')) {
    return Promise.resolve()
  }
  if (!document.head) return Promise.resolve()

  let timer: ReturnType<typeof setTimeout> | undefined
  let promise = new Promise<void>((resolve) => {
    let finish = () => {
      if (timer !== undefined) clearTimeout(timer)
      link.remove()
      // A late event from a hint that was already replaced must not delete the
      // newer pending entry for the same asset.
      if (pendingAssets.get(key)?.link === link) pendingAssets.delete(key)
      resolve()
    }

    // Last-resort cleanup: a hint removed by something other than load/error
    // must not strand the pending entry forever.
    timer = setTimeout(finish, 15_000)
    link.addEventListener('load', finish, { once: true })
    link.addEventListener('error', finish, { once: true })
    document.head.append(link)
  })

  pendingAssets.set(key, { link, promise, timer })
  return promise
}

function assetKey(link: HTMLLinkElement): string {
  return JSON.stringify([link.href, link.as, link.crossOrigin, link.integrity, link.referrerPolicy])
}
