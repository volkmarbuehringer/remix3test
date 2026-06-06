import type { Handle, Props } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { getCsrfToken } from 'remix/middleware/csrf'

export interface RestfulFormProps extends Props<'form'> {
  /**
   * The name of the hidden <input> field that contains the method override value.
   * Default is `_method`.
   */
  methodOverrideField?: string
  /**
   * Explicit CSRF token to include. When omitted, the token is retrieved from
   * the request context automatically (requires asyncContext() middleware).
   */
  csrfToken?: string
}

/**
 * A wrapper around the `<form>` element that supports RESTful API methods like
 * `PUT`, `DELETE`, and `PATCH`.
 *
 * When the method is not `GET` or `POST`, a hidden `<input>` field is added to
 * the form with a "method override" value that instructs the server to use the
 * specified method when routing the request.
 *
 * Requires `methodOverride()` middleware in the router stack.
 *
 * CSRF protection: when the form method is POST/PUT/DELETE/PATCH, a hidden
 * `_csrf` input is automatically included. Requires `csrf()` middleware in
 * the router stack and `asyncContext()` to be available.
 */
export function RestfulForm(handle: Handle<RestfulFormProps>) {
  return () => {
    let { method = 'GET', methodOverrideField = '_method', csrfToken, ...props } = handle.props
    let upperMethod = method.toUpperCase()

    if (upperMethod === 'GET') {
      return <form method="GET" {...props} />
    }

    let token = csrfToken
    if (token === undefined) {
      try {
        token = getCsrfToken(getContext())
      } catch {
        // CSRF middleware may not be active — omit token
      }
    }

    return (
      <form method="POST" {...props}>
        {upperMethod !== 'POST' && (
          <input type="hidden" name={methodOverrideField} value={upperMethod} />
        )}
        {token ? <input type="hidden" name="_csrf" value={token} /> : null}
        {props.children}
      </form>
    )
  }
}
