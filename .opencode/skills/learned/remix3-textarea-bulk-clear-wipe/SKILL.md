---
name: remix3-textarea-bulk-clear-wipe
description: "Historical Remix 3 textarea bug where re-diffing an unchanged `defaultValue`/`value` wiped the textarea (bulk-clear fast path). FIXED UPSTREAM — workaround removed; use plain `defaultValue` now."
origin: manual
---

# Remix 3 Textarea: `diffChildren` Bulk-Clear Wiped Unchanged `defaultValue`/`value`

**Status: RESOLVED upstream.** Fixed by `remix-run/remix` commit `f5b5c5340` ("Preserve textarea values on first update after hydration", PR #11880). The installed `@remix-run/ui` guard now reads `reconcile.ts:1725-1734`: the bulk-clear fast path requires `curr.length > 0` (it only fires when a committed child is actually being removed). Keep this delta only as history/context — do not re-apply the workaround.

## The original bug (for context)

`@remix-run/ui` renders a textarea's `value`/`defaultValue` prop into a DOM **text child** (`buildTextareaElementSegment` in `server/stream.ts`), but that text child is **not tracked** in the committed `_children` array — it is owned by the prop, not by child vnodes.

`diffChildren` had a bulk-clear fast path (`runtime/reconcile.ts`):

```typescript
if (
  next.length === 0 &&
  anchor === undefined &&
  !parentUsesInnerHTML(vParent) &&
  canBulkClearChildren(curr)
) {
  domParent.textContent = ''   // ← wiped the textarea's value text
}
```

When a textarea was re-diffed with an **unchanged** `value`/`defaultValue`, `_children` was `[]` and the bulk-clear fired, erasing the value text; `patchHostProps` then skipped (prev === next) and never repaired it. Typing still worked because each keystroke changed the value and repaired the wipe.

## The old workaround (REMOVED — do not reintroduce)

Rendering the value as children kept it tracked (`next.length !== 0`), so the bulk-clear never fired. This required an `as never` cast because the framework's JSX types declare `children?: never` on textarea. The three sites in `app/actions/lists/public/lists-client.tsx` (description, new-item, edit-item textareas) used it and were reverted to `defaultValue={...}` after the upstream fix landed.

## Resolution notes

- Upstream guard change: `packages/ui/src/runtime/reconcile.ts` — `diffChildren` bulk-clear now gated on `curr.length > 0`.
- Upstream tests: `packages/ui/src/test/hydration.forms.test.tsx` covers untouched `defaultValue`, user-edited `defaultValue`, and controlled `value` across repeated updates.
- The app's controlled-input fields were never affected — inputs have no text children, so bulk-clear was a no-op there.
- App code after revert: `defaultValue={description}` / `defaultValue={newItemLabel}` / `defaultValue={editText}` in `app/actions/lists/public/lists-client.tsx`. The `title`/`description` fields stay uncontrolled and still rely on `syncFieldInputs()` refs to push state into the DOM on list load.