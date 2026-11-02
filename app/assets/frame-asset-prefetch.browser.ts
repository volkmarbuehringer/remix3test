/**
 * Destination asset discovery for warmed frame HTML.
 *
 * `run({ prefetch })` replaces the runtime default, including its asset-prefetch half:
 * the vendor's `createDefaultPrefetch()` reads the HTML inertly and adds
 * `<link rel="prefetch">` hints for the destination's JavaScript, CSS, and declared
 * image/font preloads. Without this module the app warms the HTML but still pays for
 * every destination asset only when the navigation starts.
 *
 * This mirrors the vendor discovery rules (remix `57ecca4cba` /
 * `@remix-run/component/src/runtime/prefetch.ts` `createDefaultPrefetch`):
 *
 * - discover `link[href]`, `script[src]`, and nested `<template>` content
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

/** Starts asset discovery for a response that was just warmed for a frame navigation. */
export function prefetchFrameAssets(response: Response, sourceUrl: URL): void {
  if (typeof document === 'undefined') return

  // A JSON/plain-text error body is never a frame fragment; nothing to discover.
  // Match the vendor default: require an explicit HTML content type rather than
  // guessing from a header-less binary response.
  let contentType = response.headers?.get?.('Content-Type')
  if (contentType == null || !contentType.toLowerCase().includes('text/html')) return

  let clone: Response
  try {
    clone = response.clone()
  } catch {
    // A partial/stubbed response (tests) or a locked body cannot be inspected.
    return
  }
  if (typeof clone.text !== 'function') return

  void clone
    .text()
    .then((html) => {
      if (html) discoverHtml(html, clone.url || sourceUrl.href)
    })
    .catch(() => {
      // Discovery is speculative; the navigation still fetches its own assets.
    })
}

/** Drops hints that have not settled yet. Used by browser tests; navigation leaves them. */
export function clearPrefetchedAssets(): void {
  for (let { link, timer } of pendingAssets.values()) {
    if (timer !== undefined) clearTimeout(timer)
    link.remove()
  }
  pendingAssets.clear()
}

function discoverHtml(html: string, responseUrl: string): void {
  let template = document.createElement('template')
  template.innerHTML = html

  let baseUrl = responseUrl
  let base = template.content.querySelector('base[href]')?.getAttribute('href')
  if (base != null) {
    try {
      baseUrl = new URL(base, responseUrl).href
    } catch {
      // An invalid base falls back to the response URL, as it would in a document.
    }
  }

  let activeAssets = collectActiveAssets()
  discoverContainer(template.content, baseUrl, activeAssets)
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

function discoverContainer(
  container: ParentNode,
  baseUrl: string,
  activeAssets: Set<string>,
): void {
  for (let element of container.querySelectorAll('link[href], script[src], template')) {
    if (element.tagName === 'TEMPLATE') {
      let content = (element as HTMLTemplateElement).content
      if (content) discoverContainer(content, baseUrl, activeAssets)
      continue
    }

    let link = createAssetPrefetch(element, baseUrl)
    if (link) void prefetchAsset(link, activeAssets)
  }
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
