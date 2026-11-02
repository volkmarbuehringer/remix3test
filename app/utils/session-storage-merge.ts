import { isDeepStrictEqual } from 'node:util'
import { createSession, type Session, type SessionStorage } from 'remix/session'

type SessionData = Session['data']

export type MergeSessionWritesOptions = {
  /**
   * Keys written with `session.flash()`. The Session API exposes flash values by
   * key but does not enumerate them, so the merge has to be told which keys to
   * carry over. These must not also be used as regular session values: `get()`
   * reads the value map first.
   */
  flashKeys?: readonly string[]
}

/**
 * `createSession()` only starts dirty when it carries flash data, and the stores
 * skip clean sessions. Deleting this absent key marks the merged session dirty
 * without changing its data.
 */
const DIRTY_MARKER = '__session_merge_dirty__'

type Snapshot = {
  id: string
  data: SessionData
  flash: Map<string, unknown>
}

/**
 * Merge overlapping writes to one session instead of letting the last response
 * win.
 *
 * The session middleware reads a snapshot before the handler runs and saves it
 * afterwards. Two overlapping requests (a frame reload and a form POST, two
 * tabs) therefore write their own stale snapshot, and the later save silently
 * drops the other request's changes. Wrapping the storage re-reads the stored
 * session at save time and re-applies only the keys this request changed, so
 * independent changes survive.
 *
 * Flash data is merged per `flashKeys`: a consumed flash is cleared unless a
 * concurrent request wrote a newer value for that key, and a flash written by
 * another request while this one ran is kept.
 *
 * This is a per-process merge. Session files are only read/written through one
 * Node process here; a multi-process deployment would need a shared, versioned
 * store.
 */
export function mergeSessionWrites(
  storage: SessionStorage,
  options: MergeSessionWritesOptions = {},
): SessionStorage {
  let flashKeys = options.flashKeys ?? []
  let snapshots = new WeakMap<Session, Snapshot>()

  function readFlash(session: Session): Map<string, unknown> {
    let flash = new Map<string, unknown>()
    for (let key of flashKeys) {
      let value = session.get(key)
      if (value !== undefined) flash.set(key, value)
    }
    return flash
  }

  return {
    async read(cookie) {
      let session = await storage.read(cookie)
      snapshots.set(session, {
        id: session.id,
        data: structuredClone(session.data),
        flash: readFlash(session),
      })
      return session
    },

    async save(session) {
      let snapshot = snapshots.get(session)
      if (
        snapshot === undefined ||
        !session.dirty ||
        session.destroyed ||
        session.deleteId !== undefined ||
        session.id !== snapshot.id
      ) {
        // Nothing to merge: a clean session (the store skips the write anyway),
        // a destroyed/regenerated/rotated id, or a session we did not read.
        return storage.save(session)
      }

      let latest = await storage.read(session.id)
      if (latest.id !== session.id) {
        // The stored session disappeared (logout in another request, retention
        // sweep). Saving recreates it, matching the store's own behavior.
        return storage.save(session)
      }

      let merged = createSession<Record<string, unknown>, Record<string, unknown>>(session.id, [
        mergeValues(snapshot.data[0], session.data[0], latest.data[0]),
        {},
      ])
      // The constructor's second element is the flash this request *consumed*;
      // a session only writes flash data added through flash().
      for (let [key, value] of Object.entries(
        mergeFlash(snapshot.flash, session.data[1], readFlash(latest), flashKeys),
      )) {
        merged.flash(key, value)
      }
      merged.set(DIRTY_MARKER, null)

      return storage.save(merged)
    },
  }
}

/** Apply only the keys this request changed on top of the stored values. */
function mergeValues(
  base: Record<string, unknown>,
  current: Record<string, unknown>,
  latest: Record<string, unknown>,
): Record<string, unknown> {
  let values: Record<string, unknown> = { ...latest }

  for (let key of unionKeys(base, current)) {
    if (isDeepStrictEqual(current[key], base[key])) continue
    if (current[key] === undefined) delete values[key]
    else values[key] = current[key]
  }

  return values
}

function mergeFlash(
  base: Map<string, unknown>,
  next: Record<string, unknown>,
  latest: Map<string, unknown>,
  flashKeys: readonly string[],
): Record<string, unknown> {
  let flash: Record<string, unknown> = {}

  for (let key of flashKeys) {
    let nextValue = next[key]
    if (nextValue !== undefined) {
      flash[key] = nextValue
      continue
    }

    let baseValue = base.get(key)
    if (baseValue !== undefined) {
      // Consumed by this request: clear it, unless a concurrent request wrote a
      // newer value under the same key.
      let latestValue = latest.get(key)
      if (latestValue !== undefined && !isDeepStrictEqual(latestValue, baseValue)) {
        flash[key] = latestValue
      }
      continue
    }

    let latestValue = latest.get(key)
    if (latestValue !== undefined) flash[key] = latestValue
  }

  return flash
}

function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
}
