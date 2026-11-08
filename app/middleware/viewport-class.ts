import type { Middleware } from 'remix/router'
import { Session } from 'remix/session'

import { readViewportClass, VIEWPORT_SESSION_KEY } from '../utils/viewport-class.ts'

/**
 * Mirrors the client's viewport class into the session.
 *
 * The browser reports the layout it is using in the `viewport` cookie (see
 * app/ui/viewport-bootstrap.ts). Copying it into the session gives every
 * request-scoped reader one answer to ask — the page-size resolution reads
 * `session.get('viewportClass')` — without threading the request through every
 * grid controller.
 *
 * The session is only written when the class actually changed: `session.set`
 * marks the session dirty, and a dirty session costs a storage write. A device
 * that never resizes therefore writes once, not on every request.
 *
 * Must run after `session()` in app/middleware/root.ts, otherwise there is no
 * session to write to.
 */
export function viewportClass(): Middleware {
  return async (context, next) => {
    let viewport = readViewportClass(context.request.headers.get('Cookie'))
    if (viewport) {
      let session = context.get(Session)
      if (session && session.get(VIEWPORT_SESSION_KEY) !== viewport) {
        session.set(VIEWPORT_SESSION_KEY, viewport)
      }
    }
    return next()
  }
}
