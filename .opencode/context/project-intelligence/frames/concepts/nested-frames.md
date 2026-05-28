<!-- Context: frames/concepts/nested-frames | Priority: high | Version: 2.0 | Updated: 2026-04-29 -->

# Nested Frames Architecture — /books1 Route

**Core Concept**: The `/books1` route uses a nested Frames hierarchy: parent page → grid Frame → card Frame → button Frame. Each book card renders as its own Frame with full BookCard component.

> ⚠️ **Anti-pattern**: Wrapping interactive client entries (like buttons) inside nested Frames causes stale props after pagination. See `guides/client-entry-in-paginated-lists.md`.

## Hierarchy

```
/books1              Parent Route
  └── Frame "books1-grid"         src: /fragments/books1-grid?page=N
        └── Frame "book-card-{id}"   src: /fragments/book-card/:bookId
              └── Frame "cart-button-{id}"  src: /fragments/cart-button/:bookId
```

| Level | Frame Name | Source | Renders |
|-------|-----------|--------|---------|
| 1 | (page) | `/books1` | Page with grid Frame |
| 2 | `books1-grid` | `/fragments/books1-grid` | Grid with card Frames |
| 3 | `book-card-{id}` | `/fragments/book-card/:bookId` | Full card + button Frame |
| 4 | `cart-button-{id}` | `/fragments/cart-button/:bookId` | Cart button |

## Unique Name Pattern

**Critical**: Each Frame in a list MUST have a unique `name` prop to prevent state leakage:

```tsx
// Grid fragment
{allBooks.map((book) => (
  <Frame
    key={book.id}
    name={`book-card-${book.id}`}
    src={routes.fragments.bookCard.href({ bookId: book.id })}
  />
))}
```

## Flow Summary

| Step | What Happens |
|------|-------------|
| 1 | User visits `/books1` |
| 2 | Server renders page with books1-grid Frame |
| 3 | books1-grid Frame loads `/fragments/books1-grid?page=1` |
| 4 | Grid fragment renders with card Frames for each book |
| 5 | Each card Frame loads `/fragments/book-card/:id` |
| 6 | Each card renders with nested cart button Frame |
| 7 | Button Frame loads `/fragments/cart-button/:id` |

## Route Configuration

```typescript
export const routes = route({
  fragments: route('fragments', {
    cartButton: get('/cart-button/:bookId'),
    books1Grid: get('/books1-grid'),
    bookCard: get('/book-card/:bookId'),
  }),
  books1: '/books1',
})
```

## See Also

- `guides/nested-frames.md` - How to implement these fixes
- `errors/*.md` - Individual error references
- `concepts/frame-boundary-hydration.md` - Why nested hydration skips inside Frames
