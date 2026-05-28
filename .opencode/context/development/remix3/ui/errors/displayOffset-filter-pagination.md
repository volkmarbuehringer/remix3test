<!-- Context: development/remix3/ui/errors | Priority: medium | Version: 1.0 | Updated: 2026-05-13 -->

# Error: Pagination Display Offset Reset When Filter Is Active

**Symptom**: With an active filter, the pagination display shows "1-20 of 40+" instead of the actual page range like "41-60 of 40+". The first number resets to 1 regardless of the current page.

## Cause

The index handler computed a `displayOffset` that reset to 0 when a filter was active:

```tsx
// ❌ BUG: displayOffset resets to 0 when filter is active
let displayOffset = filter ? 0 : offset
```

The grid handler then used `displayOffset` in the pagination display calculation:

```tsx
let pageStart = displayOffset + 1   // shows "1" when filter is active
let pageEnd = displayOffset + rows.length
```

But the grid Frame's `src` used the raw `offset`, so the actual data was correct — only the display number was wrong.

## Symptom

```
Filter active, page 3 (offset 40):
   Display: "1-20 of 40+"   ← wrong! offset shows as 0
   Actual:  rows 41-60      ← data is correct, only display is wrong
```

## Fix

Remove `displayOffset` entirely. Use the raw URL `offset` everywhere:

```diff
- let displayOffset = filter ? 0 : offset
- let pageStart = displayOffset + 1
- let pageEnd = displayOffset + rows.length
+ let pageStart = rows.length > 0 ? offset + 1 : 0
+ let pageEnd = offset + rows.length
```

The grid handler in `ClientGridPage` already uses offset directly via props — the fix is to stop deriving a modified display offset.

## Why This Happened

The `displayOffset` was originally introduced to handle the case where filter results might not start at offset 0. But `paginate()` already handles filtering correctly at the database level — the offset always refers to the filtered result set. There is no case where filter results need a synthetic reset of the displayed offset.

## Prevention Checklist

- [ ] Grid/table pagination display uses raw URL `offset`, never a derived/reset variant
- [ ] `offset` prop passed to grid component matches the URL query param
- [ ] Test pagination display with: no filter (page 2+), active filter (page 2+), cleared filter

## Reference

- `controllers/client/controller.tsx` — had the `displayOffset` in index handler (now fixed)
- `controllers/client/grid-page.tsx` — `ClientGridPage` uses raw `offset` prop for display
- `guides/inline-edit-pattern.md` — Inline edit pattern that this was part of
