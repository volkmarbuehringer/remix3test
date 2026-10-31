import type { FrameContent, ResolveFrameOptions } from 'remix/component'
import { Accept, SuperHeaders } from 'remix/headers'

import { routes } from '../routes.ts'
import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import { ErrorCard, actionLinkCss } from './error-card.browser.tsx'

/**
 * Whether a frame source may be resolved into this document.
 *
 * Frame HTML is trusted application content: it can select client-entry modules and
 * contribute import maps, styles, and nested frames to this document. Only same-origin
 * sources are resolved — mirroring the runtime's default `resolveFrame`, which fetches with
 * `mode: 'same-origin'` (remix #11849). Without this check a cross-origin source would be
 * fetched with same-origin credentials and injected as frame content.
 */
export function isSameOriginFrameSource(url: URL): boolean {
  return url.origin === window.location.origin
}

type FrameFetchResult =
  | { kind: 'response'; response: Response }
  | { kind: 'navigated' }
  | { kind: 'error-card'; content: FrameContent }

interface FrameFetchOptions extends ResolveFrameOptions {
  /**
   * Prefetches only warm the cache from a hover/focus intent: they must not navigate the
   * document, must not consume a one-shot agent prefill, and must not cache the recovery
   * card for a 5xx.
   */
  mode?: 'navigate' | 'prefetch'
}

/**
 * Fetches a frame source and classifies the outcome, so the navigation and prefetch
 * callers can share one request path while applying different side effects.
 */
async function fetchFrameResponse(
  url: URL,
  options?: FrameFetchOptions,
): Promise<FrameFetchResult> {
  let prefetching = options?.mode === 'prefetch'

  if (!isSameOriginFrameSource(url)) {
    // Cross-origin sources fall back to document navigation, matching the runtime's
    // behavior for invalid/cross-origin frame navigation sources. Never fetched.
    if (!prefetching) window.location.assign(url.href)
    return { kind: 'navigated' }
  }

  let headers = new SuperHeaders()
  headers.accept = new Accept('text/html')
  headers.set('X-Remix-Frame', 'true')

  if (options?.target) {
    headers.set('X-Remix-Target', options.target)
  }

  let prefillKey = url.pathname + url.search
  let prefill = agentPrefillMap.get(prefillKey)
  if (prefill) {
    let encoded = new TextEncoder().encode(JSON.stringify(prefill))
    let binary = String.fromCharCode(...new Uint8Array(encoded))
    headers.set('X-Agent-Prefill', btoa(binary))
  }

  let { body, encType } = getRequestBody(options)
  if (encType) headers.set('Content-Type', encType)
  let response = await fetch(url, {
    cache: 'no-store',
    headers,
    // A hover warm must not compete with the navigation it is meant to accelerate.
    ...(prefetching ? { priority: 'low' as const } : {}),
    ...(options?.method !== undefined ? { method: options.method } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  })

  // A prefetch only warms this URL; keep a one-shot prefill available for a real
  // navigation that misses the cache (a cache hit deletes it in the entry resolver).
  if (prefill && response.ok && !prefetching) {
    agentPrefillMap.delete(prefillKey)
  }

  // A redirected response may contain document UI that is not valid for the requested subframe.
  // The server's frameRedirects() already follows the same-section destinations that render
  // a fragment, so a redirect still visible here crossed a section or left the in-frame set:
  // perform a document navigation instead of injecting the destination document into the frame.
  if (response.redirected && options?.target) {
    if (!prefetching) window.location.assign(response.url)
    return { kind: 'navigated' }
  }

  if (response.status === 401) {
    if (!prefetching) window.location.assign(routes.auth.login.index.href())
    return { kind: 'navigated' }
  }

  if (!response.ok) {
    // The server may return a meaningful fragment for a non-2xx outcome such as
    // a form validation re-render (400) or a not-found page (404). Render the
    // response body only when it is HTML — a JSON/plain-text error body is not a
    // usable fragment. Treat 5xx as a genuine server error, where the body is
    // not a usable fragment and a reload is the right recovery.
    if (response.status < 500 && isHtmlResponse(response)) {
      return { kind: 'response', response }
    }

    if (prefetching) return { kind: 'navigated' }

    if (response.status < 500) {
      // A frame target that answers a 4xx with a non-HTML body is a routing
      // mistake, not a validation re-render. Show the recovery card and report
      // it; do not reconcile a JSON/plain-text body as frame HTML.
      return nonHtmlFrameError(url, response)
    }

    return { kind: 'error-card', content: recoveryCard() }
  }

  // A 2xx frame target that declares a non-HTML body (a download or API
  // endpoint) is equally unreconcilable. Missing Content-Type stays allowed so
  // header-less responses (tests, hand-built fragments) keep working.
  let contentType = response.headers?.get('Content-Type')
  if (contentType != null && !contentType.toLowerCase().includes('text/html')) {
    if (prefetching) return { kind: 'navigated' }
    return nonHtmlFrameError(url, response)
  }

  return { kind: 'response', response }
}

function nonHtmlFrameError(url: URL, response: Response): FrameFetchResult {
  console.error(
    `[frame] ${response.status} ${url.pathname} returned a non-HTML body (` +
      `${response.headers?.get('Content-Type') ?? 'no content type'})`,
  )
  return { kind: 'error-card', content: recoveryCard() }
}

function recoveryCard(): FrameContent {
  return (
    <ErrorCard
      eyebrow="Unexpected Error"
      title="Reload required"
      message="An unexpected error occurred. Please reload the page to try again."
      action={
        <a data-rmx-document href={window.location.href} mix={actionLinkCss}>
          Reload
        </a>
      }
    />
  )
}

export async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<FrameContent | Response> {
  let result = await fetchFrameResponse(url, options)
  if (result.kind === 'response') return result.response
  if (result.kind === 'error-card') return result.content
  return new Promise<never>(() => {})
}

/**
 * Warms a frame response for the runtime's prefetch hook. Returns the response only when a
 * real navigation would render it; the paths that navigate the document, show the recovery
 * card, or must not be reused (redirect with a target, 401, 5xx) yield undefined.
 */
export async function prefetchFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<Response | undefined> {
  let result = await fetchFrameResponse(url, { ...options, mode: 'prefetch' })
  return result.kind === 'response' ? result.response : undefined
}

function isHtmlResponse(response: Response): boolean {
  let contentType = response.headers?.get('Content-Type')
  return contentType != null && contentType.toLowerCase().includes('text/html')
}

/**
 * Encode a frame request body the same way the runtime's default `resolveFrame`
 * does (remix #11938): GET/HEAD carry no body, POST defaults to URL encoding,
 * and the matching `Content-Type` is returned so it can be set explicitly.
 * This resolver replaces the runtime default, so it must mirror it.
 */
function getRequestBody(options?: ResolveFrameOptions): {
  body?: BodyInit
  encType?: string
} {
  let formData = options?.formData
  if (!formData) return {}
  if (['get', 'head'].includes((options?.method ?? 'get').toLowerCase())) return {}

  let encType = options?.encType?.toLowerCase()

  if (encType === 'multipart/form-data') return { body: formData }

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return { body: new Blob([body], { type: 'text/plain' }), encType: 'text/plain' }
  }

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(
      normalizeLineBreaks(name),
      normalizeLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  return { body, encType: 'application/x-www-form-urlencoded' }
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
