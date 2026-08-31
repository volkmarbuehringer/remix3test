import { getContext } from 'remix/middleware/async-context'
import { frames } from '../routes.ts'

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
  try {
    let target = getContext().request.headers.get('X-Remix-Target')
    if (target === frames.agentEventsPanel) {
      return target
    }
  } catch {
    /* no request context → default to admin content */
  }
  return frames.adminContent
}
