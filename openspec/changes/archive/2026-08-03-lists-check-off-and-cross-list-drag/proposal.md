## Why

The `/lists` editor already has drag-and-drop reorder, inline edit, autosave, and conflict handling, but items are plain `{ id, label }` tuples and reordering is confined to a single list. Users cannot mark items complete, and there is no way to move an item into another list. Two upgrades turn lists from a flat scratchpad into a practical working tool: a check-off affordance (the canonical list interaction) and cross-list drag-and-drop (leveraging the sidebar rows, which already carry `data-list-id` / `data-updated-at`).

## What Changes

- **Item done-state**: list items gain an optional `done: boolean`. An absent field reads as `false` — no DB migration, since items live in the jsonb `list` column. Checked items render with a checkbox and a struck-through, muted label.
- **Sidebar progress**: the sidebar count badge becomes a progress indicator (`done/total`) computed server-side from the same jsonb.
- **Cross-list drag (desktop)**: sidebar list rows become drop targets for item drags. Dropping an item appends it to the target list and removes it from the source.
- **New atomic `move` action**: `POST /lists/:id/move` (source list id in path, body carries `targetId`, `itemId`, and source `If-Match`). The move is a single `db.transaction` that removes the item from the source, appends it to the target, and bumps `updated_at` on both lists. Moving the last item out of a source list is rejected (`400`) — a list can never be emptied via drag.
- **Post-move refresh**: after a successful move the client flushes pending autosave, then reloads the frame so the sidebar counts and editor re-read from the server.
- **Gesture disambiguation**: the intra-list reorder indicator and the cross-list sidebar highlight are mutually exclusive during a drag.
- **Conflict policy**: the source list is `If-Match`-checked (it is the list being edited); the target is appended blind (append-last-wins). This is accepted — a target race is unlikely.
- **Scope**: HTML5 drag-and-drop is desktop-only; no touch gesture support is added in this change.

## Capabilities

### New Capabilities

None — both features are requirements of the existing lists editing capability.

### Modified Capabilities

- `lists-editing`: the item shape gains `done` state; the write-action surface grows from three actions to four with the new `move` action; sidebar rows gain cross-list drop semantics; the editor gains a check-off toggle and the flush-then-reload post-move flow.

## Impact

- `app/data/lists.ts` — `ListRow` item type gains `done?`; `assignStableIds` preserves `done`; new `moveItemBetweenLists` backed by `db.transaction` (pattern: `app/data/nutzer.ts`).
- `app/actions/lists/controller.tsx` — `listItemSchema` accepts optional `done`; new `move` action with ownership scoping, source `If-Match`, and the last-item guard; sidebar entries now carry `doneCount`.
- `app/routes.ts` — add `move: post('/:id/move')` to the `lists` route map.
- `app/actions/lists/lists-client.browser.tsx` — checkbox toggle + fast autosave, struck-through label styling, sidebar-row drop-target wiring via `[data-list-id]`, dual-drop-zone gesture state, flush-then-reload on move success.
- `app/ui/lists-layout.tsx` — sidebar progress badge and drop-target highlight styling.
- Tests — data-layer move transaction (source/target both updated, last-item rejection), controller `move` validation (404 foreign, 409 stale, 400 last item), item `done` round-trip through patch, and the gesture disambiguation logic as pure functions (pattern: `schedule-layout.ts` / `appointment-grid`).

## Notes

- The existing `lists-editing` spec describes the patch action as `patch` / `PATCH /:id`, but the current code surface is `update` / `PUT /:id` (`app/routes.ts:35`). This proposal targets the real code surface; reconciling that existing drift is out of scope but is called out here so the `move` action is named consistently.
