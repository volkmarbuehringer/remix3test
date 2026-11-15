import { getContext } from 'remix/middleware/async-context'

/** The `X-Remix-Target` of the given request, or null when it is not a frame subrequest. */
export function requestFrameTarget(request: Pick<Request, 'headers'>): string | null {
  return request.headers.get('X-Remix-Target')
}

/**
 * True when the given request is a frame subrequest addressed to one of `names`.
 * Use this in controllers, where the `context.request` is in hand.
 */
export function isFrameTargeted(request: Pick<Request, 'headers'>, ...names: string[]): boolean {
  let target = requestFrameTarget(request)
  return target != null && names.includes(target)
}

/** The `X-Remix-Target` of the current request context, or null outside a context. */
export function currentFrameTarget(): string | null {
  try {
    return getContext().request.headers.get('X-Remix-Target')
  } catch {
    /* no request context */
    return null
  }
}

/**
 * True when the current context's request addresses one of `names`.
 * Use this inside components; outside a request context it is false.
 */
export function currentRequestTargetsFrame(...names: string[]): boolean {
  let target = currentFrameTarget()
  return target != null && names.includes(target)
}

/**
 * True when the current request is a frame the renderer resolved *inside*
 * another response — the internal SSR subrequest behind a `<Frame>`, not a
 * browser frame navigation.
 *
 * The renderer creates those subrequests itself and marks them with the
 * enclosing document's `X-Remix-Top-Frame-Src`; a browser frame navigation
 * sends `X-Remix-Frame`/`X-Remix-Target` but never that header. The HTML
 * rendered here is spliced into a larger response, so response-level chrome
 * (the one-shot flash banner, the document `Layout`) belongs to the enclosing
 * document and must not also render in this fragment.
 */
export function currentRequestIsInlinedFrame(): boolean {
  try {
    return getContext().request.headers.get('X-Remix-Top-Frame-Src') != null
  } catch {
    /* no request context */
    return false
  }
}

/**
 * Pure decision behind `getSelfFrameTarget()`, split out so the per-panel
 * branches are unit-testable without a request context.
 *
 * Returns the frame the current render is nested in, or `undefined` when the
 * request is not a frame subrequest (a standalone document). A standalone page
 * must not name a frame: the named target would not be mounted, and the runtime
 * would perform a full document navigation (`06-streaming-ui-with-frames.md`
 * §"Target a frame from a link"). Returning `undefined` lets the runtime reload
 * the top frame, which is the whole document.
 */
export function selfFrameTarget(currentTarget: string | null): string | undefined {
  return currentTarget ?? undefined
}

/**
 * Frame that the currently-rendered page is embedded in, or `undefined` for a
 * standalone document.
 *
 * Grid pages (users, appointments, …) carry `data-rmx-target={getSelfFrameTarget()}`
 * for their sidebar CRUD navigation. That is correct when the page lives directly
 * in the admin content frame, but when such a page is loaded into a nested agent
 * panel frame (agent-events-panel or support-agent-panel) the hardcoded target
 * would reload the OUTER admin-content frame — tearing down the host agent page
 * (the "agent dialog disappears" bug). When rendering inside an agent panel
 * frame, the page's own links/forms must instead target that panel so they stay
 * put. A standalone document (the Verwaltung section, or a full-document POST
 * re-render) names no frame at all: the target would not be mounted and the
 * runtime would replace the whole document (`06` §"Target a frame from a link").
 */
export function getSelfFrameTarget(): string | undefined {
  return selfFrameTarget(currentFrameTarget())
}
