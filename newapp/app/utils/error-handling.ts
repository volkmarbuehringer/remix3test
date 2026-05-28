import { getContext } from 'remix/middleware/async-context'
import { redirect } from 'remix/response/redirect'

export function toastRedirect(
  url: string | URL,
  msg: string,
  isError = false,
): Response {
  let session = getContext().session
  if (session == null) {
    throw new Error('Expected session() middleware before toastRedirect()')
  }
  let key = isError ? 'error' : 'success'
  session.flash(key, msg)
  let urlString = url instanceof URL ? url.pathname + url.search : url
  return redirect(urlString)
}
