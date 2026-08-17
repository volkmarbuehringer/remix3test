---
name: remix3-textarea-bulk-clear-wipe
description: "Remix 3 textarea with unchanged defaultValue/value loses its content on re-diff — diffChildren's bulk-clear fast path wipes prop-owned text content; render textarea content as children (as never) to keep it tracked"
origin: manual
---

# Remix 3 Textarea: `diffChildren` Bulk-Clear Wipes Unchanged `defaultValue`/`value`

**Validated:** 2026-08-17
**Context:** Re-diffing a textarea whose `defaultValue`/`value` prop is unchanged silently empties it. Observed in `app/actions/lists/lists-client.browser.tsx`: clicking "Bearbeiten" opened the edit textarea empty instead of prefilled.

## Problem

`@remix-run/ui` renders a textarea's `value`/`defaultValue` prop into a DOM **text child** (`~/remix/packages/ui/src/server/stream.ts:549` `buildTextareaElementSegment` renders `<textarea attrs>escaped-value-text</textarea>`). But that text child is **not tracked** in the committed `_children` array — it is owned by the prop, not by child vnodes.

`diffChildren` has a bulk-clear fast path (`~/remix/packages/ui/src/runtime/reconcile.ts:1568-1581`):

```typescript
if (
  next.length === 0 &&
  anchor === undefined &&
  !parentUsesInnerHTML(vParent) &&
  canBulkClearChildren(curr)
) {
  for (let i = 0; i < curr.length; i++) cleanupDescendants(curr[i], context)
  domParent.textContent = ''   // ← wipes the textarea's value text
  return EMPTY_COMMITTED_CHILDREN
}
```

When a textarea is re-rendered (a fresh `diffHost` pass) and its `_children` is `[]` (because the value came from `defaultValue`, not children), the bulk-clear fires and `domParent.textContent = ''` erases the value text. `patchHostProps` then runs, but if the prop value is **unchanged** (`prevValue === nextValue`) it skips — so the wipe is never repaired. Result: an empty textarea whose prop "says" it should have content.

### Why typing still works

On each keystroke the state value *changes*, so `patchHostProps` re-sets the prop after the wipe and repairs it. The bug only surfaces when a textarea is re-diffed with an **unchanged** value — e.g. two synchronous `handle.update()` passes triggered by a single user action (a button `on('click')` handler plus a bubbling row `on('click')` handler).

## Verified mechanism (instrumentation)

`[DBG] BULK-CLEAR TEXTAREA curr=0 next=0` fires on the second update pass, immediately followed by no `patchHostProps SET` (skipped: `"Alpha" === "Alpha"`). The childList mutation removed the value text node.

## Solution: render textarea content as children (workaround)

Keep the value tracked as a child vnode so `next.length !== 0` and the bulk-clear path never fires; the text node is then diffed normally and the textarea always re-populates from the rendered value:

```tsx
<textarea mix={[...]}>
  {editText as never}
</textarea>
```

The `as never` cast is required: the framework's JSX types declare `children?: never` on textarea (`@remix-run/ui/dist/runtime/dom.d.ts` `TextareaHTMLProps` — "Textarea content comes from value or defaultValue"), so raw child text fails `tsc` with `TS2322: Type 'string' is not assignable to type 'undefined'`. The cast is the deliberate escape hatch for this framework runtime bug; the value is diffed via `diffText`, not innerHTML, so no escaping concern.

## Constraints

- This is a framework runtime bug: `~/remix` is read-only vendor, and the installed `@remix-run/ui` is a branch-pinned tarball (`github:remix-run/remix#preview/main&path:packages/remix`). Do **not** edit `node_modules/.pnpm/.../@remix-run/ui/dist/runtime/reconcile.js` as a permanent fix — a reinstall re-downloads the tarball and reverts it. The upstream fix belongs in `diffChildren`'s bulk-clear guard (exclude `TEXTAREA` from `canBulkClearChildren`).
- A controlled `value={...}` prop is equally affected — the unchanged-value skip still applies. Only tracked children survive re-diff.
- Applies to any textarea re-diffed with unchanged `value`/`defaultValue`: the edit textarea (`app/actions/lists/lists-client.browser.tsx`) and the new-item textarea (same file, previously `defaultValue={newItemLabel}`). The description **input** uses `defaultValue` safely — inputs have no text children, so bulk-clear is a no-op there.
