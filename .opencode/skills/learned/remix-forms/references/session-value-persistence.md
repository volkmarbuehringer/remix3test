# Session Values Persist Only Through set/unset

**Extracted:** 2026-10-09

## Problem

`@remix-run/session`'s `Session` is backed by a `Map`, and `get(key)` returns the
stored value by reference — so mutating a stored object/array in place looks like
it should save:

```ts
let sizes = session.get('pageSizes') as Record<string, number>
sizes[pageKey] = 25        // in-place mutation — NOT persisted
```

Session storage only writes when `session.dirty` is true:

```ts
// @remix-run/session/src/lib/session-storage/fs.ts
async save(session) {
  if (session.dirty) { await fsp.writeFile(file, JSON.stringify(session.data), 'utf-8') }
  return null
}
```

`dirty` is set only inside `set()`, `unset()`, and `regenerateId()`
(`src/lib/session.ts`: getter at line 79; `#dirty = true` in those methods). In-place
mutation sets nothing. Worse, it is order-dependent: if the same request also calls
`session.set()` for another key, the whole map is serialized and the mutation is
persisted too — so the failure looks intermittent.

## Solution

Always read-modify-write the container and call `set()` with a **fresh** object, or
`unset()` to delete a key:

```ts
// store/overwrite one entry in a per-page map
let current = session.get('pageSizes')
let map = current && typeof current === 'object' ? { ...current } : {}
session.set('pageSizes', { ...map, [pageKey]: value })

// delete one entry (session has no deleteValue; set(key, null) also unsets)
let next = { ...readMap(session) }
delete next[pageKey]
session.set('pageSizes', next)
```

Verified against the installed `@remix-run/session` (both `fs.ts:96` and
`memory.ts:47` guard on `session.dirty`).

## When to Use

- A session value you mutated in place is `undefined`/stale on the next request.
- Storing a map/array/set in the session (per-page preferences, per-grid state).
- Writing a `setX(session, key, value)` helper that mutates instead of calling `set()`.
