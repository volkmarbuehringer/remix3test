import type { Middleware } from 'remix/router'
import { Accept, SuperHeaders } from 'remix/headers'
import { frames } from '../routes.ts'

const MAX_FRAME_REDIRECTS = 10

/**
 * Frame targets whose subframe form submissions may follow a PRG redirect
 * in-frame. The destination must also stay inside the request's top-level URL
 * section, so a redirect that leaves the framed area (e.g. settings'
 * delete-account → /auth/login) still reaches the client bail as a real
 * document navigation. Verwalung pages are whole-page navigation and never
 * carry these targets.
 */
const IN_FRAME_REDIRECT_TARGETS: ReadonlySet<string> = new Set([
  frames.adminContent,
  frames.listsContent,
  frames.agentEventsPanel,
  frames.supportAgentPanel,
  frames.settingsPanel,
  frames.appointmentsNewContent,
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
 * The destination must render a fragment for the matching target header.
 * Every target listed above has a route that branches on it; the section
 * guard keeps redirects to login or another shell out of the frame.
 */
export function frameRedirects(): Middleware {
  return async (context, next) => {
    let response = await next()

    let target = context.request.headers.get('X-Remix-Target')
    if (context.request.headers.get('X-Remix-Frame') !== 'true' || target == null) {
      return response
    }
    if (!IN_FRAME_REDIRECT_TARGETS.has(target)) return response
    if (!isRedirectResponse(response)) return response

    let location = response.headers.get('Location')
    if (!location) return response

    let depth = Number(context.request.headers.get('X-Remix-Redirect-Depth')) || 0
    if (depth >= MAX_FRAME_REDIRECTS) return response

    let destination = new URL(location, context.url)
    if (destination.origin !== context.url.origin) return response
    // A cross-section redirect is a real page change (login, another shell):
    // leave it for the client, whose redirect bail performs a document
    // navigation. Only a same-section destination is a fragment update.
    if (!sameSection(context.url, destination)) return response

    let headers = new SuperHeaders()
    headers.accept = new Accept('text/html')
    headers.set('X-Remix-Frame', 'true')
    headers.set('X-Remix-Target', target)
    headers.set('X-Remix-Redirect-Depth', String(depth + 1))

    let cookie = context.request.headers.get('Cookie')
    if (cookie) headers.set('Cookie', cookie)

    // The server boundary stamps X-Client-Ip from the TCP socket address;
    // forward it so this internal re-entry keeps its real client attribution
    // (rate limiting, localhost guards) instead of collapsing into the
    // headerless 'unknown' bucket. See app/utils/request-ip.ts.
    let clientIp = context.request.headers.get('X-Client-Ip')
    if (clientIp) headers.set('X-Client-Ip', clientIp)

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
    // later frame reload GETs that URL → 405. The client stub (entry.tsx)
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

/** The first path segment: /settings?tab=x -> settings, / -> '' */
function sectionOf(url: URL): string {
  return url.pathname.split('/').filter(Boolean)[0] ?? ''
}

function sameSection(from: URL, to: URL): boolean {
  return sectionOf(from) === sectionOf(to)
}
