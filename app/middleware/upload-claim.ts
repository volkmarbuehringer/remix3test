import { AsyncLocalStorage } from 'node:async_hooks'
import type { Middleware } from 'remix/router'

type UploadClaimState = { uploadedIds: string[] }

const storage = new AsyncLocalStorage<UploadClaimState>()

/**
 * Establishes a per-request scope for the ids of uploads created during this
 * request. It MUST run before the `formData()` middleware so the `uploadHandler`
 * (which runs while `formData()` parses the body) can record the ids here.
 *
 * Ownership of an upload is claimed from this server-side scope only — never
 * from the client-supplied `file` form field — so a caller cannot claim another
 * user's unclaimed upload by posting an arbitrary id.
 */
export function uploadClaimScope(): Middleware {
  return (_context, next) => storage.run({ uploadedIds: [] }, next)
}

/**
 * Record a single server-generated upload id for the current request. Called
 * once per accepted file; supports multiple files in one request.
 */
export function addUploadedId(id: string): void {
  let state = storage.getStore()
  if (!state) {
    throw new Error(
      'uploadClaimScope() must run before formData({ uploadHandler }); see app/middleware/root.ts',
    )
  }
  state.uploadedIds.push(id)
}

/**
 * Drain and return every server-generated upload id recorded during this
 * request, in the order the files were parsed.
 */
export function takeUploadedIds(): string[] {
  let state = storage.getStore()
  if (!state) return []
  let ids = state.uploadedIds
  state.uploadedIds = []
  return ids
}
