## Why

The `/lists` sidebar lets a user drag a single item from the editor onto another list (a move), and duplicate a whole list into a brand-new list, but there is no way to combine two existing lists. Users who keep several short lists and want them consolidated must open the source list, select and move items one by one, or duplicate then re-merge manually. Dragging one sidebar list onto another should append its items into the target, leaving the source intact.

## What Changes

- Sidebar list rows become draggable. Dropping list `A` onto a different list `B` copies every item of `A` into `B` (appended at the end) and leaves `A` unchanged.
- Copied items receive fresh ids and preserve `done`, `priority`, `due`, `tags`, and `updatedAt`. The target's `updated_at` is bumped.
- A confirmation prompt (`window.confirm`) gates the merge; cancelling leaves both lists untouched.
- New write action `POST /lists/:sourceId/merge` with body `{ targetId }` and a required `If-Match` of the source's `updated_at`, mirroring the existing `move` contract. Rejections: self-drop (`400`), empty source (`400`), missing precondition (`400`), foreign/unknown list (`404`), stale source (`409`).
- The existing item→list move gesture is unchanged; list drags are a distinct payload so the two drop paths never collide.
- No keyboard equivalent is added in this change (explicit non-goal); the sidebar roving-tabindex navigation from `lists-keyboard-accessibility` is unaffected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lists-editing`: adds the "Merge list into list via sidebar drag" requirement, and updates the `Resource-oriented write actions` and `Dead show route removed` requirements whose route-map enumeration must now include the new `merge` action.

## Impact

- `app/data/lists.ts`: new `mergeListIntoList` transactional helper (locks both rows, fresh ids, source precondition) plus a `MergeResult` type.
- `app/routes.ts`: add `merge: post('/:id/merge')` to the `lists` route map.
- `app/actions/lists/controller.tsx`: add the `merge` action (schema, precondition, error mapping).
- `app/ui/lists-layout.tsx`: make sidebar rows draggable and expose the target `updated_at` (already present as `data-updated-at`).
- `app/actions/lists/public/lists-client.tsx`: list-drag state, drag wiring on sidebar rows, confirm + flush + `POST` + frame reload, and dragend cleanup.
- `app/actions/lists/controller.test.ts`: merge action tests (copy, fresh ids, source unchanged, self/empty/foreign/stale rejections).
- No schema/migration changes: items live in the existing `list` JSONB column.
