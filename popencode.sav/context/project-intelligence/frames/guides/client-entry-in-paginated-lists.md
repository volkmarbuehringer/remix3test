---
title: Client Entries in Paginated Lists
description: How to render interactive client entries inside paginated Frame content without stale props.
---

# Guide: Client Entries in Paginated Lists

**Purpose**: Render interactive elements (like cart buttons) inside paginated lists where the parent `<Frame>` reloads on navigation.

## Anti-Pattern: Frame Wrapper

Do NOT wrap client entries in `<Frame>` inside paginated content:

```tsx
// ❌ BROKEN - Stale props after pagination
{allBooks.map((book) => (
  <Frame
    name={`cart-button-${book.id}`}
    src={routes.fragments.cartButton.href({ bookId: book.id })}
  />
))}
```

**Why it fails**: The diff algorithm skips hydration markers inside `rmx:f:` boundaries, so nested client entries keep props from the first page.

## Correct Pattern: Direct Render

Render the client entry directly with props computed by the fragment handler:

```tsx
// ✅ CORRECT - Props update on every frame reload
{allBooks.map((book) => {
  let inCart = cart.items.some((item) => item.bookId === book.id)
  return <BookCard book={book} inCart={inCart} />
})}
```

The `BookCard` renders `<CartButton inCart={inCart} id={book.id} slug={book.slug} />` directly.

## Local State + Props Sync

When a client entry manages local state AND receives props, track the last prop value to avoid resetting local changes on self-triggered re-renders:

```tsx
export const CartButton = clientEntry(import.meta.url, function CartButton(handle: Handle) {
  let inCart = false
  let lastPropInCart = false

  return ({ inCart: propInCart, id, slug }) => {
    if (propInCart !== lastPropInCart) {
      inCart = propInCart
      lastPropInCart = propInCart
    }
    // ... render and toggle inCart locally on click
  }
})
```

## When to Use Frame vs Direct Render

| Use Frame | Render Directly |
|-----------|-----------------|
| Self-contained server-rendered region | Interactive button needing prop updates |
| Content that loads independently | Element inside paginated list |
| Structural layout regions | Individual list items with state |

## Steps

1. Compute props in the fragment handler (e.g., `inCart` from `getCurrentCart()`)
2. Pass props directly to the client entry component
3. Track `lastPropValue` inside `clientEntry` to sync props without clobbering local state
4. Update local state directly after API calls instead of reloading the frame

## Verification

- Click pagination Next/Previous
- Verify interactive element props match the new page's data
- Verify local state mutations (clicks) persist across re-renders

## See Also

- `concepts/frame-boundary-hydration.md` - Why Frame wrappers cause stale props
- `errors/stale-props-after-pagination.md` - Full error breakdown
- `errors/client-entry-state-reset.md` - Local state reset issue
