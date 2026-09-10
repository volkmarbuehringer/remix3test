## Context

See `proposal.md` for motivation and `specs/lists-editing/spec.md` for the requirements this design implements.

The `/lists` feature already ships two related sidebar interactions that this change must slot beside without disturbing:

- **Item → list move**: an editor item drag calls `POST /lists/:sourceId/move` (`app/actions/lists/controller.tsx:268`), backed by `moveItemBetweenLists` (`app/data/lists.ts:461`). It wires sidebar rows as drop targets from `ListsClient` via `startSidebarDragWiring` (`app/actions/lists/public/lists-client.tsx:1077`) and `resolveDropZone` (`app/actions/lists/public/drop-zone.ts`).
- **List duplicate**: `POST /lists/:id/copy` (`app/data/lists.ts:416`) clones a list into a *new* list with fresh item ids.

Constraints that shape the approach:

- Sidebar rows are server-rendered in `app/ui/lists-layout.tsx` as `<div data-list-id data-updated-at>` wrapping a `NavLink` plus rename/copy/delete buttons. They already carry the target's `updated_at`.
- The `/lists` client entry (`ListsClient`, `app/actions/lists/public/lists-client.tsx`) holds the editor state and is the only place with `loadedListId`, `flushNow()`, `getCsrfHeaders()`, and `handle.frame`. It re-inits DOM wiring on `handle.frame`'s `reloadComplete` event.
- Item ids are strings stored in the `list` JSONB column; there is no separate items table and no schema migration needed.

## Goals / Non-Goals

**Goals:**

- Add a list → list drag gesture that appends a fresh-id copy of the source's items into the target, leaving the source intact.
- Reuse the existing `move` contract conventions (route shape, CSRF, `If-Match`, 409 conflict handling) so the new action is predictable and cheap to test.
- Keep the existing item → list move gesture behaviorally identical.

**Non-Goals:**

- No keyboard-initiated merge (explicitly deferred; the sidebar roving-tabindex navigation is untouched).
- No deduplication of identical items, no undo, no merge of title/description (only elements are copied).
- No reordering of sidebar list order (there is no backend ordering).

## Decisions

### Endpoint mirrors `move`: `POST /lists/:sourceId/merge`, `If-Match` on the source

Body is `{ targetId }`; the precondition is the source's last-known `updated_at`. This matches `move` exactly (path id = source, target in body, `If-Match` on the path resource), so the client can reuse `getCsrfHeaders`, the `_if_match` fallback, and the existing 409 handling verbatim.

*Alternative considered:* precondition on the target (`POST /lists/:targetId/merge { sourceId }`). Rejected — appending is non-destructive so a target precondition adds little safety, and it would break symmetry with `move`/`copy` (whose path id is the acting list), forcing a second client code path.

### Fresh ids, append at the end, copy metadata

The server maps each source item to `{ ...item, id: crypto.randomUUID() }` (the same rule `copyList` already uses) and concatenates after the target's existing items. `done`, `priority`, `due`, `tags`, and `updatedAt` are carried over. Fresh ids are mandatory: the source retains its items, so reusing ids would create duplicate ids across lists and violate the stable-identity requirement.

### Confirmation via `window.confirm` in the drop handler

The repo's `data-confirm` mechanism (`app/ui/confirm-delete.browser.tsx`) is a capture-phase click listener scoped to `form[data-confirm]` submissions; a drag-drop merge has no form. The drop handler therefore calls `window.confirm(...)` with the source/target names and item count before issuing the request. This matches the existing use of native `confirm()` elsewhere and needs no new dialog component.

### Distinguish list drags from item drags with a dedicated `dataTransfer` type

Item drags set `text/plain` to the item index and gate all drop logic on `dragIndex !== null`. List drags set a distinct `text/x-list-id` payload and never assign `dragIndex`, so the existing editor `dragover`/`drop` handlers (which early-return when `dragIndex === null`) ignore list drags. A `dragKind: 'item' | 'list' | null` flag in `ListsClient` keeps the two wiring paths separate.

### Wiring lives in `ListsClient`, not a new sidebar client entry

A standalone sidebar entry could not flush the editor's pending edits, so it could not guarantee the server reads the latest source/target before merging. `ListsClient` already queries `[data-list-id]` rows and re-inits on `reloadComplete`; list-drag `dragstart`/`dragover`/`drop`/`dragend` listeners are attached there (with `AbortController` cleanup mirroring `ListsRowActions` and `ListsSidebarKeyboard`).

### Flush before merge when source or target is loaded

If either list is the currently-loaded (and dirty) list, the handler awaits `flushNow()` before the merge so the subsequent frame reload does not discard unsaved edits. When neither is loaded, the server rows are authoritative and no flush is needed. The `If-Match` precondition is resolved **after** the flush: saving the open list bumps its `updated_at`, so a snapshot taken before the flush would be rejected as stale. For the open list the live `loadedUpdatedAt` is used; for any other source, its server-rendered sidebar snapshot.

### Rows are draggable in server markup; inner controls are guarded

`app/ui/lists-layout.tsx` adds `draggable` to the row wrapper. The `dragstart` handler calls `preventDefault()` when the event target is inside a `button`, `input`, `textarea`, or `[contenteditable]` (the same guard item drags use), so rename/copy/delete and the nav link keep their click behavior.

## Risks / Trade-offs

- **Native `<a>` drag hijacks the gesture** → Set an explicit `text/x-list-id` payload and `effectAllowed = 'copy'`; all handlers key on the custom type, and interactive children are guarded from starting a drag.
- **Sidebar DOM is replaced on frame reload while a drag is in flight** → Re-init wiring on `reloadComplete` and abort prior listeners via `AbortController`; `dragend` always clears highlight, `dragKind`, and wiring.
- **Repeated merges duplicate items** → By design (no dedupe); the confirmation names both lists and the item count so the user sees what will be appended.
- **Stale source view** → Source `If-Match` yields `409` with the current source row. If the stale row *is* the open list, the existing conflict banner handles it (its reload/overwrite actions are bound to the loaded list). Otherwise the client must not reuse that banner — hydrating it would silently switch the editor to another list — so it refreshes the sidebar row's `data-updated-at` and asks the user to drag again.
- **Two lists, one transaction** → Lock both rows in id order (as `moveItemBetweenLists` does) to avoid deadlocks; only the target is written.

## Migration Plan

No database migration. Additive route and action; rollback is removing the `merge` route/action and the client wiring. Existing `move`/`copy` behavior is unchanged.

## Open Questions

None.
