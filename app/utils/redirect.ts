/**
 * Validate and sanitize a `returnTo` query parameter to prevent
 * open-redirect attacks. Only same-site absolute paths are allowed.
 * Uses URL parsing to reject paths that resolve outside the current
 * origin (e.g. browsers normalize backslashes in redirect locations),
 * and paths that normalize to a protocol-relative `//host` target.
 */
export function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') return undefined
  if (!returnTo.startsWith('/')) return undefined

  let baseURL = 'https://remix.local'
  let url: URL
  try {
    url = new URL(returnTo, baseURL)
  } catch {
    return undefined
  }
  // A same-origin path can still normalize to a leading `//` (e.g.
  // `//remix.local//evil.com` → pathname `//evil.com`); a browser treats that
  // Location as protocol-relative and leaves the origin, so reject it too.
  if (url.origin !== baseURL || url.pathname.startsWith('//')) return undefined
  return url.pathname + url.search + url.hash
}
