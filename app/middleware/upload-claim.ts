import { AsyncLocalStorage } from 'node:async_hooks'
import type { Middleware } from 'remix/router'

type UploadClaimState = { uploadedId?: string }

const storage = new AsyncLocalStorage<UploadClaimState>()

/**
 * Establishes a per-request scope for the id of an upload created during this
 * request. It MUST run before the `formData()` middleware so the `uploadHandler`
 * (which runs while `formData()` parses the body) can record the id here.
 *
 * Ownership of an upload is claimed from this server-side scope only — never
 * from the client-supplied `file` form field — so a caller cannot claim another
 * user's unclaimed upload by posting an arbitrary id.
 */
export function uploadClaimScope(): Middleware {
  return (_context, next) => storage.run({}, next)
}

export function setUploadedId(id: string): void {
  let state = storage.getStore()
  if (!state) {
    throw new Error(
      'uploadClaimScope() must run before formData({ uploadHandler }); see app/middleware/root.ts',
    )
  }
  state.uploadedId = id
}

export function takeUploadedId(): string | undefined {
  let state = storage.getStore()
  if (!state) return undefined
  let id = state.uploadedId
  state.uploadedId = undefined
  return id
}
