import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'

/**
 * A hidden `<input name="_csrf">` rendered during SSR.
 * Must be placed inside a `<form method="POST">` to provide
 * the CSRF token required by the `csrf()` middleware.
 *
 * Returns `null` (renders nothing) when the CSRF middleware
 * is not active or `getContext()` is unavailable.
 */
export function CsrfTokenInput() {
  return () => {
    try {
      let token = getCsrfToken(getContext())
      return <input type="hidden" name="_csrf" value={token} />
    } catch {
      return null
    }
  }
}

/**
 * Safely resolve the CSRF token during SSR.
 * Returns `undefined` when the CSRF middleware is not active.
 */
export function tryGetCsrfToken(): string | undefined {
  try {
    return getCsrfToken(getContext())
  } catch {
    return undefined
  }
}
