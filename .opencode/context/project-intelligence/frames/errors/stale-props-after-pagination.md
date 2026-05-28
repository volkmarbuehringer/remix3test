---
title: Stale Props After Pagination
description: Client entries show wrong prop values after paginating a parent Frame.
---

# Error: Stale Props After Pagination

**Symptom**: Interactive elements (e.g., cart buttons) show correct values on initial load, but wrong values after clicking Next/Previous pagination.

**Example**: Page 1 shows "Add to Cart" for book A. After clicking Next and back, book A still shows "Add to Cart" even though it was added to cart on page 2.

## Root Cause

The client entry was wrapped in a `<Frame>`:

```tsx
// ❌ BROKEN
<Frame
  name={`cart-button-${book.id}`}
  src={routes.fragments.cartButton.href({ bookId: book.id })}
/>
```

During SSR, this generates `<!-- rmx:f:{id} -->...<!-- /rmx:f -->` markers. When the parent `books1-grid` frame reloads after pagination, `diffElementChildren` skips all `rmx:h:` hydration markers inside nested `rmx:f:` frame regions. The existing virtual roots are preserved with stale props from page 1.

**Files involved**:
- `@remix-run/component/src/lib/diff-dom.ts` - Diff algorithm
- `@remix-run/component/src/lib/frame.ts` - `createSubFrames` reusing instances

## Solution

Remove the `<Frame>` wrapper and render the client entry directly:

```tsx
// ✅ FIXED
<CartButton inCart={inCart} id={book.id} slug={book.slug} />
```

Also compute the actual prop value in the fragment handler instead of hardcoding:

```tsx
let cart = getCurrentCart()
let inCart = cart.items.some((item) => item.bookId === book.id)
return <BookCard book={book} inCart={inCart} />
```

## Prevention

- Do NOT wrap individual interactive buttons inside `<Frame>` in paginated lists
- Use `<Frame>` for structural regions that load independently (like the grid itself)
- See `guides/client-entry-in-paginated-lists.md` for decision criteria
