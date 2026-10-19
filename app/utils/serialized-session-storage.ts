import type { SessionStorage } from 'remix/session'

/**
 * Serialize session-storage operations in this process.
 *
 * The filesystem session store writes each session file in place with
 * `writeFile` (truncate, then write). A concurrent request that reads the same
 * session can observe an empty/partial file and throw
 * `SyntaxError: Unexpected end of JSON input` from JSON.parse. Frame reloads
 * and cancel links can overlap with a form POST's session save, so queue the
 * reads/writes instead of letting them interleave.
 *
 * This is a per-process fix. A multi-process deployment would need a shared
 * store or an atomic-write storage backend.
 */
export function serializeSessionStorage(storage: SessionStorage): SessionStorage {
  let pending: Promise<unknown> = Promise.resolve()

  function run<T>(operation: () => Promise<T>): Promise<T> {
    let result = pending.then(operation, operation)
    pending = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    read: (cookie) => run(() => storage.read(cookie)),
    save: (session) => run(() => storage.save(session)),
  }
}
