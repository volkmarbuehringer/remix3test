import { getContext } from 'remix/middleware/async-context'
import { frames } from '../routes.ts'

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
 * Frame that the currently-rendered page is embedded in.
 *
 * Grid pages (users, appointments, …) hardcode `data-rmx-target={frames.adminContent}`
 * for their sidebar CRUD navigation. That is correct when the page lives directly
 * in the admin content frame, but when such a page is loaded into a nested agent
 * panel frame (agent-events-panel) the hardcoded target would
 * reload the OUTER admin-content frame — tearing down the host agent page (the
 * "agent dialog disappears" bug). When rendering inside an agent panel frame, the
 * page's own links/forms must instead target that panel so they stay put.
 *
 * Returns the active agent-panel target when the request was rendered into one,
 * otherwise the admin content frame (the existing default).
 */
export function getSelfFrameTarget(): string {
  let target = currentFrameTarget()
  if (target === frames.agentEventsPanel) {
    return target
  }
  return frames.adminContent
}
