import { defaultResolveFrame } from 'remix/component'
import type { FrameContent, ResolveFrameOptions } from 'remix/component'

import { routes } from '../routes.ts'
import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import { ErrorCard, actionLinkCss } from './error-card.browser.tsx'
import { createAdminListsPanelCommit } from './frame-transition.browser.ts'

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

type FrameMode = 'navigate' | 'prefetch'

type FrameFetchResult =
  | { kind: 'response'; response: Response }
  | { kind: 'navigated' }
  | { kind: 'error-card'; content: FrameContent }

/**
 * What the app should do with a frame response.
 *
 * Kept separate from the side effects so the 4xx/5xx/401 policy is directly testable:
 * `window.location.assign` cannot be stubbed in a real browser test.
 */
export type FrameOutcome =
  /** Render the response body inside the frame. */
  | { kind: 'render' }
  /** Do nothing; a real navigation must not happen (prefetch) or already bailed. */
  | { kind: 'navigated' }
  /** Leave the frame document for `url` (a redirect that crossed sections). */
  | { kind: 'document-navigation'; url: string }
  /** The frame target is unauthenticated; the document must go to the login page. */
  | { kind: 'login' }
  /** Show the reload recovery card (5xx / non-HTML body). */
  | { kind: 'recovery-card' }
  /** A 4xx with a non-HTML body is a routing mistake; report it and show the card. */
  | { kind: 'non-html-error' }

/**
 * Classifies a fetched frame response with the app's policy. Total over every response the
 * runtime can produce, including the ones `defaultResolveFrame` rejects before returning.
 */
export function classifyFrameResponse(
  response: Response,
  options?: { target?: string | undefined; mode?: FrameMode | undefined },
): FrameOutcome {
  let prefetching = options?.mode === 'prefetch'

  // A redirected response may contain document UI that is not valid for the requested subframe.
  // The server's frameRedirects() already follows the same-section destinations that render
  // a fragment, so a redirect still visible here crossed a section or left the in-frame set:
  // perform a document navigation instead of injecting the destination document into the frame.
  if (response.redirected && options?.target) {
    return prefetching ? { kind: 'navigated' } : { kind: 'document-navigation', url: response.url }
  }

  if (response.status === 401) {
    return prefetching ? { kind: 'navigated' } : { kind: 'login' }
  }

  if (prefetching) {
    // Only a response a real navigation would render may be warmed: never the recovery
    // card for a 5xx, a redirect, a login bounce, or a non-HTML body.
    return isRenderableFrameResponse(response) ? { kind: 'render' } : { kind: 'navigated' }
  }

  if (response.status >= 500) return { kind: 'recovery-card' }

  if (isRenderableFrameResponse(response)) return { kind: 'render' }

  // A 4xx with a non-HTML body is a routing mistake, not a validation re-render; a 2xx
  // that declares a non-HTML body (a download or API endpoint) is equally unreconcilable.
  return response.status < 500 ? { kind: 'non-html-error' } : { kind: 'recovery-card' }
}

function isRenderableFrameResponse(response: Response): boolean {
  // 5xx is a genuine server error: its body is never a reusable fragment, even when
  // the server declares HTML for it.
  if (response.status >= 500) return false

  let contentType = response.headers?.get('Content-Type')
  let isHtml = contentType != null && contentType.toLowerCase().includes('text/html')

  // A 2xx frame target that omits Content-Type stays allowed so header-less responses
  // (tests, hand-built fragments) keep working. A non-2xx body must declare HTML:
  // a form validation re-render (400) or a not-found page (404) is an intended
  // fragment, while a JSON/plain-text error body is not.
  return response.ok ? contentType == null || isHtml : isHtml
}

/**
 * Fetches a frame source and classifies the outcome, so the navigation and prefetch
 * callers can share one request path while applying different side effects.
 *
 * Request construction (method, form encoding, `Accept`, `X-Remix-Frame`,
 * `X-Remix-Target`, `Content-Type`, `same-origin`) is delegated to the runtime's
 * `defaultResolveFrame` (remix #12249/#11938). The `fetch` override keeps the app-only
 * policy: the one-shot `X-Agent-Prefill` payload, `cache: 'no-store'`, and low priority
 * for a hover warm.
 *
 * `defaultResolveFrame` rejects every `5xx` and every non-HTML `3xx`/`4xx` with a plain
 * `Error` before returning the response, so those outcomes are reclassified here from the
 * response captured by the override.
 */
async function fetchFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
  mode: FrameMode = 'navigate',
): Promise<FrameFetchResult> {
  let prefetching = mode === 'prefetch'

  if (!isSameOriginFrameSource(url)) {
    // Cross-origin sources fall back to document navigation, matching the runtime's
    // behavior for invalid/cross-origin frame navigation sources. Never fetched.
    if (!prefetching) window.location.assign(url.href)
    return { kind: 'navigated' }
  }

  let prefillKey = url.pathname + url.search
  let prefill = agentPrefillMap.get(prefillKey)
  let prefillHeader: string | undefined
  if (prefill) {
    let encoded = new TextEncoder().encode(JSON.stringify(prefill))
    let binary = String.fromCharCode(...new Uint8Array(encoded))
    prefillHeader = btoa(binary)
  }

  // `defaultResolveFrame` validates the response *after* the fetch override returns,
  // so a rejected response can only be classified by keeping a reference to it.
  let fetched: Response | undefined
  let response: Response
  // The commit override is keyed by the returned response identity; it must be
  // attached before classification returns that same object.
  let commit = createAdminListsPanelCommit(options)
  try {
    response = await defaultResolveFrame(url.href, options, {
      async fetch(fetchUrl, init) {
        let headers = new Headers(init.headers)
        if (prefillHeader !== undefined) headers.set('X-Agent-Prefill', prefillHeader)
        let result = await fetch(fetchUrl, {
          ...init,
          headers,
          cache: 'no-store',
          // A hover warm must not compete with the navigation it is meant to accelerate.
          ...(prefetching ? { priority: 'low' as const } : {}),
        })
        fetched = result
        return result
      },
      ...(commit ? { commit } : {}),
    })
  } catch (error) {
    // A network/abort failure has no response to classify — surface it like the
    // previous hand-rolled resolver did, so the runtime's error channel reports it.
    if (!fetched) throw error
    response = fetched
  }

  // A prefetch only warms this URL; keep a one-shot prefill available for a real
  // navigation that misses the cache (a cache hit deletes it in the entry resolver).
  if (prefill && response.ok && !prefetching) {
    agentPrefillMap.delete(prefillKey)
  }

  let outcome = classifyFrameResponse(response, { target: options?.target, mode })

  let result: FrameFetchResult
  switch (outcome.kind) {
    case 'render':
      result = { kind: 'response', response }
      break
    case 'document-navigation':
      window.location.assign(outcome.url)
      result = { kind: 'navigated' }
      break
    case 'login':
      window.location.assign(routes.auth.login.index.href())
      result = { kind: 'navigated' }
      break
    case 'navigated':
      result = { kind: 'navigated' }
      break
    case 'non-html-error':
      result = nonHtmlFrameError(url, response)
      break
    case 'recovery-card':
      result = { kind: 'error-card', content: recoveryCard() }
      break
  }
  return result
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
  let result = await fetchFrameResponse(url, options, 'prefetch')
  return result.kind === 'response' ? result.response : undefined
}
