<!-- Context: frames/errors/missing-unique-frame-names | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Missing Unique Frame Names

**Symptom**: Cart button state from page 1 appears on page 2 at the same DOM position.

**Root Cause**: The cart button Frame inside each book card had no `name` prop. The browser's frame manager couldn't distinguish frames without unique names, causing state to leak across pagination.

```typescript
// ❌ BROKEN - No name prop causes state leak
<Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />

// ✅ FIXED - Unique name for each frame instance
<Frame
  name={`cart-button-${book.id}`}
  src={routes.fragments.cartButton.href({ bookId: book.id })}
/>
```

**Affected Files**: `bookstore/app/controllers/fragments/controller.tsx`

## Prevention

Every Frame in a list MUST have a unique `name` prop using the item's ID. Never render a `<Frame>` without a `name` when inside a repeated list.

## See Also

- `guides/client-entry-in-paginated-lists.md` - Correct pattern for interactive list items
- `nested-frames.md` - Nested frames architecture
