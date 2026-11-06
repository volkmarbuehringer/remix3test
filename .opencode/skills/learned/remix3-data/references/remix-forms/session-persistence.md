# Session Persistence: Flash vs Set, and In-Place Mutation

**Source:** consolidated from `session-flash-routing` and `session-value-persistence`.
**Extracted:** 2026-10-09 … 2026-10-10
**Revalidated:** 2026-11-06 against preview release `v0.20261106.150533-main-305d22d0` / source `305d22d0` (`@remix-run/session` 1.0.1).
**Context:** Two sides of the same session API: one-shot post-action UI state that must self-clear (flash), and mutating a stored container that silently fails to persist (dirty tracking).

## One-shot UI state: `session.flash()`, not `session.set()`

When a user completes an action (e.g. booking an appointment) and you want to show a routing decision card ("Fertig" / "Noch einen Termin"), `session.set()` creates a hard gate:

```ts
// action handler
session.set('routingFlag', '1')  // persists across refreshes

// index handler
if (session.get('routingFlag')) → render routing card, hide textarea
```

Two bugs follow:

1. **Stuck state on refresh** — the flag persists, so the routing card shows again after refresh; the user cannot type or interact normally.
2. **Stuck state on missing display data** — if `session.set('bookingResult', msg)` is consumed but `session.set('routingFlag')` persists, the UI renders nothing: no routing card (no text), no textarea (flag blocks it).

Use `session.flash()` for any UI state that should render once and disappear on refresh:

```ts
// action handler
session.flash('postBookingDecision', '1')
session.set('bookingResult', 'Termin #42 wurde gebucht.')

// index handler — flash is consumed on read
let postBookingDecision = session.get('postBookingDecision')  // '1' once, then null
let bookingResult = session.get('bookingResult')
if (bookingResult) session.unset('bookingResult')
```

The routing card renders only on the first GET after the POST. On refresh the flash is gone and the normal UI returns. Frame fragments render only the top-level `Layout` — see `remix3-ui § Frames` (`references/remix3-frame-cliententry/session-flash-frames.md`).

## `set()` marks the session dirty; in-place mutation does not

`@remix-run/session`'s `Session` is backed by a `Map`, and `get(key)` returns the stored value by reference — mutating a stored object/array in place looks like it should save:

```ts
let sizes = session.get('pageSizes') as Record<string, number>
sizes[pageKey] = 25        // in-place mutation — NOT persisted
```

Session storage writes only when `session.dirty` is true. Both the fs and memory stores guard on it; `dirty` is set only inside `set()`, `unset()`, `regenerateId()`, and `flash()` (`src/lib/session.ts` getter at `:79`; `#dirty = true` in those methods). In-place mutation sets nothing.

Worse, the failure is order-dependent: if the same request also calls `session.set()` for another key, the whole map is serialized and the mutation is persisted too — so it looks intermittent.

Read-modify-write the container and call `set()` with a **fresh** object, or `unset()` to delete a key:

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

Verified against the installed `@remix-run/session` (both `fs.ts:144` and `memory.ts:47` guard on `session.dirty`).

## Shared rules

- Use `session.flash()` for one-shot UI state; use `session.set()`/`unset()` for values that must persist.
- After a frame PRG, `frameRedirects()` must run **outside** `session()` so the flash is persisted before the follow re-enters; the destination fragment must render the flash itself (`FlashBanner`).
- Saving a rebuilt flash needs `session.flash(key, value)`; `createSession(id, [values, flash])` treats the second element as **already consumed** and writes `{}`.
- `save()` returns the id for a dirty session, `null` for a clean one (no `Set-Cookie`), and `''` for a destroyed one; a wrapper must delegate those states unchanged.

## When to Use

- A one-shot card/banner after a POST survives a refresh, or a consumed display value plus a persisting flag leaves the page blank.
- A session value you mutated in place is `undefined`/stale on the next request, or you store a map/array/set in the session.
- Writing a `setX(session, key, value)` helper that mutates instead of calling `set()`.
- A flash message disappears in a frame fragment or a test reads an empty session.
