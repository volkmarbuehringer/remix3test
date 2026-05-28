/**
 * Validate and sanitize a `returnTo` query parameter to prevent
 * open-redirect attacks. Only same-site absolute paths are allowed.
 * Uses URL parsing to reject paths that resolve outside the current
 * origin (e.g. browsers normalize backslashes in redirect locations).
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
  if (url.origin !== baseURL) return undefined
  return url.pathname + url.search + url.hash
}
