import { applyHardeningHeaders } from '../middleware/security-headers.ts'

// `remix/node-fetch-server` rejects malformed request targets and authorities
// before the handler runs. Its `RequestTargetError`/`RequestAuthorityError`
// classes are package-local (not exported from the entrypoints), so classify by
// the three stable messages the listener itself treats as client errors.
// Without this branch the app's `onError` logs them and renders its 500 page.
const MALFORMED_REQUEST_MESSAGES = new Set([
  'Invalid request target: backslash in path',
  'Invalid request authority',
  'Host header does not match :authority',
])

export function isMalformedRequestError(error: unknown): boolean {
  return error instanceof Error && MALFORMED_REQUEST_MESSAGES.has(error.message)
}

/**
 * The vendor answers a malformed request with a bare 400. Keep that status and
 * shape (no app shell, no log line) and add the hardening headers the
 * request-scoped middleware chain cannot apply on this pre-handler path.
 */
export function renderBadRequest(): Response {
  let headers = new Headers()
  applyHardeningHeaders(headers)
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  headers.set('Cache-Control', 'no-store')

  return new Response('Bad Request', { status: 400, headers })
}
