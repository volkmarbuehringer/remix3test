import type { Middleware } from 'remix/router'
import { Accept, SuperHeaders } from 'remix/headers'
import { frames } from '../routes.ts'

const MAX_FRAME_REDIRECTS = 10

/**
 * Frame targets whose subframe form submissions are allowed to follow a
 * redirect in-frame (PRG) under the admin shell. Verwalung / appointment
 * frames are intentionally out of scope for now: their redirects still fall
 * back to the client-side bail (full top-level navigation).
 */
export const ADMIN_FRAME_TARGETS: ReadonlySet<string> = new Set([
  frames.adminContent,
  frames.listsContent,
  frames.agentEventsPanel,
  frames.supportAgentPanel,
])

/**
 * Keeps PRG form submissions inside the target frame.
 *
 * A subframe request carries `X-Remix-Frame: true` plus a non-null
 * `X-Remix-Target`. When such a request ends in a redirect (the app's CRUD
 * controllers redirect unconditionally on success), the destination is
 * re-fetched as a GET with the frame headers so it can render a fragment for
 * the subframe instead of forcing a full top-level page load. This restores
 * the "no reload after form submit" behavior that the client-side redirect
 * bail (frame-response.browser.tsx) would otherwise turn into a reload.
 *
 * The destination only renders a fragment when it opts in via the matching
 * target header; routes that render a full document (or an auth 401 fragment)
 * are returned as-is and the client-side runtime decides how to handle them.
 */
export function frameRedirects(): Middleware {
  return async (context, next) => {
    let response = await next()

    let target = context.request.headers.get('X-Remix-Target')
    if (context.request.headers.get('X-Remix-Frame') !== 'true' || target == null) {
      return response
    }
    // Step 1: only admin shell frames follow in-frame. Other targets (e.g.
    // verwaltung) return the redirect unchanged so the client bail handles them.
    if (!ADMIN_FRAME_TARGETS.has(target)) return response
    if (!isRedirectResponse(response)) return response

    let location = response.headers.get('Location')
    if (!location) return response

    let depth = Number(context.request.headers.get('X-Remix-Redirect-Depth')) || 0
    if (depth >= MAX_FRAME_REDIRECTS) return response

    let destination = new URL(location, context.url)
    if (destination.origin !== context.url.origin) return response

    let headers = new SuperHeaders()
    headers.accept = new Accept('text/html')
    headers.set('X-Remix-Frame', 'true')
    headers.set('X-Remix-Target', target)
    headers.set('X-Remix-Redirect-Depth', String(depth + 1))

    let cookie = context.request.headers.get('Cookie')
    if (cookie) headers.set('Cookie', cookie)

    let frameResponse = await context.router.fetch(
      new Request(destination, {
        method: 'GET',
        headers,
        signal: context.request.signal,
      }),
    )

    // Tell the client where the frame actually landed. A following-in-frame
    // redirect returns a 200 fragment, so the runtime cannot infer the
    // destination from response.redirected. Without this the frame's `src` is
    // left at the POST action URL (e.g. /admin/users/2/toggle-disabled) and a
    // later frame reload GETs that URL → 404. The client stub (entry.tsx)
    // reads this header and reconciles the frame's src.
    try {
      frameResponse.headers.set('X-Remix-Redirect-To', destination.href)
    } catch {
      /* headers may be immutable — the frame keeps its current src */
    }

    // The internal fetch re-enters this middleware, so a further 3xx is either
    // followed in-frame or returned unchanged once MAX_FRAME_REDIRECTS is hit.
    return frameResponse
  }
}

function isRedirectResponse(response: Response): boolean {
  return response.status >= 300 && response.status < 400 && response.headers.has('Location')
}
