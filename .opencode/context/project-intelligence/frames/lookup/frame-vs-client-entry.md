---
title: Frame vs Client Entry Decision
description: Quick reference for choosing between <Frame> and direct clientEntry rendering.
---

# Lookup: Frame vs Client Entry

## Decision Table

| Scenario | Use `<Frame>` | Use `clientEntry` Directly |
|----------|--------------|---------------------------|
| Paginated list item with props | ❌ No | ✅ Yes |
| Self-contained region (grid, sidebar) | ✅ Yes | ❌ No |
| Independent loading boundary | ✅ Yes | ❌ No |
| Single interactive button | ❌ No | ✅ Yes |
| Content that never updates props | Either | Either |

## Rules

1. **Props change on parent reload?** → Render `clientEntry` directly
2. **Structural region loading its own fragment?** → Use `<Frame>`
3. **Interactive element inside paginated list?** → Render `clientEntry` directly

## Anti-Pattern Checklist

- [ ] Wrapping a single button in `<Frame>`
- [ ] Expecting nested client entries to re-hydrate on parent Frame reload
- [ ] Assigning props unconditionally inside `clientEntry` render function

## Related

- `concepts/frame-boundary-hydration.md` - Why Frame boundaries skip hydration
- `guides/client-entry-in-paginated-lists.md` - Full implementation guide
