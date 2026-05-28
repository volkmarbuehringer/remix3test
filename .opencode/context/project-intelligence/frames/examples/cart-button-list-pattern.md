---
title: CartButton List Pattern
description: Correct pattern for rendering CartButton in a paginated book list.
---

# Example: CartButton in Paginated List

**Purpose**: Show the correct way to render an interactive cart button inside a paginated grid.

## Fragment Handler

```tsx
// bookstore/app/controllers/fragments/controller.tsx
async books1Grid({ get, url }) {
  // ... pagination logic ...
  let cart = getCurrentCart()

  return renderFragment(
    <div>
      <Pagination currentPage={page} totalPages={totalPages} />
      <div class="grid">
        {allBooks.map((book) => {
          let inCart = cart.items.some((item) => item.bookId === book.id)
          return <BookCard book={book} inCart={inCart} />
        })}
      </div>
    </div>,
  )
}
```

## BookCard UI

```tsx
// bookstore/app/ui/book-card.tsx
export function BookCard() {
  return ({ book, inCart }: BookCardProps) => (
    <div class="book-card">
      {/* ... */}
      <CartButton inCart={inCart} id={book.id} slug={book.slug} />
    </div>
  )
}
```

## Client Entry with Prop Sync

```tsx
// bookstore/app/assets/cart-button.tsx
export const CartButton = clientEntry(import.meta.url, function CartButton(handle: Handle) {
  let inCart = false
  let lastPropInCart = false

  return ({ inCart: propInCart, id, slug }) => {
    if (propInCart !== lastPropInCart) {
      inCart = propInCart
      lastPropInCart = propInCart
    }
    // ... click handler toggles inCart locally
    return <button>{inCart ? 'Remove' : 'Add'}</button>
  }
})
```

## Related

- `guides/client-entry-in-paginated-lists.md` - Full guide
- `errors/stale-props-after-pagination.md` - Error this pattern avoids
