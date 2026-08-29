import { SuperHeaders } from 'remix/headers'

/**
 * Response init for frame fragment responses: never cached, since fragments
 * are re-rendered per request and SSE/live regions depend on fresh output.
 */
export function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new SuperHeaders(init?.headers)
  if (!headers.cacheControl) {
    headers.cacheControl = { noStore: true }
  }

  return { ...init, headers }
}
