## Context

The `/lists` feature (`app/actions/lists/lists-client.browser.tsx`, `app/data/lists.ts`, `app/actions/lists/controller.tsx`, `app/ui/lists-layout.tsx`) is a clientEntry editor with autosave, `If-Match` optimistic concurrency, conflict banners, and HTML5 drag-and-drop reorder inside a single list. Items are `{ id, label }` objects in the jsonb `list` column; the sidebar renders server-side inside the same `lists-content` frame and its rows already carry `data-list-id` / `data-updated-at`. See proposal.md for motivation.

Two facts constrain the design:

- `assignStableIds` (`app/data/lists.ts:43`) rebuilds items as `{ id, label }` — it must preserve any new field or check-off state is silently dropped on every write.
- The controller rejects empty `items` arrays (`controller.tsx:194`), so "forbid moving the last item" is consistent with existing behavior — a list can already never be emptied via the update path.

## Goals / Non-Goals

**Goals:**

- Check-off items that persist through every write path (create, update, move), back-compatible with existing rows
- Sidebar progress derived from the same jsonb, server-rendered
- Atomic cross-list move in a single transaction with source-precondition enforcement
- Dual drop zones (editor reorder + sidebar move) with mutually exclusive visual feedback
- Desktop HTML5 drag-and-drop only; no changes to the existing autosave/conflict machinery

**Non-Goals:**

- Touch / pointer-gesture support (HTML5 DnD is desktop-only)
- Positional drop into a target list (drop appends at end)
- Drag-to-reorder the sidebar lists themselves
- Reordering lists in the sidebar (still `created_at DESC`)
- Migrations for existing data (absent `done` reads as `false`)

## Decisions

| Decision | Choice | Rationale / Alternatives |
| --- | --- | --- |
| **Item `done` field** | Add optional `done: boolean` to items; extend `assignStableIds` to preserve it | Without extending `assignStableIds` every write drops the flag. Alternative (separate column per item) is impossible — items are jsonb. |
| **Schema validation** | `listItemSchema` gains `done: s.optional(s.boolean())` (`controller.tsx:30`) | Rejects malformed payloads before touching the DB. |
| **Sidebar progress** | Controller computes `doneCount` from `row.list` when building `sidebarEntries`; badge renders `done/total` | No extra query — derived from data already loaded. Filtered and paginated paths both compute it. |
| **Move action shape** | `POST /lists/:sourceId/move`, body `{ targetId, itemId }`, source `If-Match` via header or `_if_match` body field | Matches the existing `POST /:id/delete` convention and the beacon-friendly `_if_match` fallback used by `update`. |
| **Atomic move** | `moveItemBetweenLists` in `app/data/lists.ts` using `db.transaction`, read-modify-write both rows (typed helpers if exposed on the tx, else `tx.exec`) | Pattern proven at `app/data/nutzer.ts:109`. Alternative (two sequential PUTs) dies on the empty-items guard and can tear on failure. |
| **Move validations** | 400: source === target, item is the last remaining item, item id not found in source; 404: source/target missing or not owned; 409: stale source `If-Match` | Mirrors `patchList` conflict semantics. Target is appended blind (append-last-wins). |
| **Ownership scoping** | `move` resolves `listUserId` like `update` (`controller.tsx:162`): non-admin must own both source and target; admin unconstrained | Reuses the existing scope rule; foreign target returns 404, not 400, to avoid probing. |
| **Post-move refresh** | On sidebar drop: if dirty → `flushNow()` first; then `move` with the refreshed `updated_at` as precondition; on success → `navigateFrame(currentHref)` | Flush-first means unsaved edits persist before the reload re-reads state (decision 1b). A stale precondition surfaces as the existing 409 conflict banner instead of a silent reload. |
| **Dual drop zones** | Track a `dropTargetSidebar: number \| null` alongside `dropIndex`; a `dragover`/`drop` handler on `[data-list-id]` rows flips it; editor-zone handlers clear it | Sidebar rows are in the same frame document, so `document.querySelectorAll('[data-list-id]')` wiring works the same way the client already reads `#lists-initial-state`. |
| **Gesture feedback** | Extract a small pure `resolveDropZone` helper (pointer + zone rects → `'list' \| 'sidebar' \| null`); unit-test it and the highlight state | Follows the `schedule-layout.ts` pattern from the appointment grid (pure, testable). Keeps the reorder indicator and sidebar highlight mutually exclusive. |

## Risks / Trade-offs

- **[Low] Sidebar rows re-render on frame navigation**: drop handlers wired onto `[data-list-id]` rows go stale after a reload. **Mitigation**: the move itself triggers a frame reload, so re-wiring on `reloadComplete` (the existing hook at `lists-client.browser.tsx:323`) is sufficient; handlers are attached lazily on drag start.
- **[Low] Filtered sidebar hides targets**: if a search filter is active, lists outside the match aren't rendered and can't receive drops. **Mitigation**: accepted — the user can clear the filter. Noted as a behavior, not a bug.
- **[Low] Append-last-wins on target conflict**: a target edited in another tab races the append. **Mitigation**: accepted per proposal; a target `If-Match` would complicate the action for a rare race.
- **[Medium] Pre-existing last-item delete quirk**: deleting the final item in the editor already produces `items: []`, which the controller rejects with 400. **Mitigation**: out of scope; the move's last-item guard is consistent with it, so the feature set stays coherent.
- **[Medium] HTML5 DnD is desktop-only**: the appointment grid's pointer gestures are the richer model but a large rewrite. **Mitigation**: explicitly a non-goal; revisit as a follow-up if touch demand appears.

## Migration Plan

No schema migration: `done` is optional jsonb data, absent reads as `false`. Existing rows render unchecked on first load. Deployment is a single app deploy; rollback is reverting the client and controller changes — no data rewrite required.

## Open Questions

None — decisions that would change the specs or task breakdown (last-item guard, flush-then-reload, target conflict policy, desktop-only scope) were resolved in exploration.
