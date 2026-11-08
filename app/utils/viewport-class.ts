/**
 * Viewport class — which layout the client is using.
 *
 * The server cannot measure a viewport, so the browser reports it: a tiny
 * inline bootstrap (app/ui/viewport-bootstrap.ts) mirrors
 * `matchMedia('(max-width: 768px)')` into the `viewport` cookie, and the
 * `viewportClass()` middleware (app/middleware/viewport-class.ts) copies that
 * cookie into the session so every request-scoped reader sees the same answer.
 *
 * The breakpoint is the one the shared `table.mobileCards` mixin uses
 * (app/ui/mixins/admin-table.ts): below it a grid row becomes a stacked card
 * with one label/value line per column, roughly 6x taller than the desktop
 * row. That is what makes the phone-sized page size (see
 * app/utils/get-page-size.ts) necessary.
 */

/** Viewport width (CSS px) at or below which the mobile layout applies. */
export const MOBILE_BREAKPOINT_PX = 768

/** Cookie the client bootstrap writes; the server reads it on every request. */
export const VIEWPORT_COOKIE = 'viewport'

/**
 * Session key the middleware mirrors the cookie into.
 *
 * The session is cookie-scoped, so this value is per browser — a phone and a
 * desktop that log in as the same user keep separate page sizes without any
 * user-account column.
 */
export const VIEWPORT_SESSION_KEY = 'viewportClass'

export type ViewportClass = 'mobile' | 'desktop'

/** True when `value` is the mobile viewport class. */
export function isMobileViewport(value: unknown): boolean {
  return value === 'mobile'
}

/**
 * The viewport class carried by a `Cookie` header, or `null` when the cookie
 * is absent or malformed.
 *
 * A missing cookie is `null` rather than a guess: the very first request from
 * a brand-new device carries no cookie (the bootstrap writes it while the
 * document loads), so the phone-sized default applies from the second request
 * on. Guessing `mobile` here would shrink the desktop layout for clients that
 * drop the cookie.
 */
export function readViewportClass(cookieHeader: string | null | undefined): ViewportClass | null {
  if (!cookieHeader) return null
  let match = /(?:^|;\s*)viewport=(mobile|desktop)(?:;|$)/.exec(cookieHeader)
  let value = match?.[1]
  return value === 'mobile' || value === 'desktop' ? value : null
}
