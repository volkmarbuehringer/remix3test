---
id: frames-nested-frames
title: Nested Frames Architecture — /books1 Route
category: project-intelligence/frames
type: guide
version: 2.1.0
author: opencode
tags: [frame, nested, server-side, books1, hierarchy]
description: Documents the nested Frames architecture in /books1 where each book card renders as its own Frame with full BookCard component.
codebase: bookstore
dependencies: []
---

# Nested Frames Architecture — /books1 Route

> **Status**: Nested Frame architecture works for structural regions, but **wrapping interactive client entries inside nested Frames is an anti-pattern**. See [client-entry-in-paginated-lists.md](./guides/client-entry-in-paginated-lists.md) for the correct approach.

## Overview

The `/books1` route demonstrates **nested Frames architecture** where each book card renders as its own Frame: parent page → grid Frame → card Frame → button Frame.

> ⚠️ **Cart button warning**: Render `CartButton` directly as a `clientEntry`, not inside a `<Frame>`. See [stale-props-after-pagination.md](../errors/stale-props-after-pagination.md).

## Architecture

```
/books1
  └── Frame (name="books1-grid", src=/fragments/books1-grid)
        ├── Frame (name="book-card-1", src=/fragments/book-card/1)
        │     └── Frame (name="cart-button-1", src=/fragments/cart-button/1)
        ├── Frame (name="book-card-2", ...)
        └── ...
```

### Level Hierarchy

| Level | Frame Name       | Source                          | Renders                   |
|-------|------------------|---------------------------------|---------------------------|
| 1     | (page)           | `/books1`                       | Page with grid Frame      |
| 2     | `books1-grid`    | `/fragments/books1-grid`        | Grid with card Frames     |
| 3     | `book-card-{id}` | `/fragments/book-card/:bookId`  | Full card + button Frame  |
| 4     | `cart-button-{id}` | `/fragments/cart-button/:bookId` | Cart button             |

## Required Fixes Summary

The following render.tsx fixes are documented in full detail in [nested-frames-errors.md](../errors/nested-frames-errors.md):

| # | Fix | v2 Pattern |
|---|-----|------------|
| 1 | Prepend DOCTYPE in render() | `createHtmlResponse(stream, init)` |
| 2 | renderFragment independent | Delegates to render() with Cache-Control: no-store |
| 3 | resolveFrame with context | Single `src` param, resolves from `request.url` |
| 4 | Strip HTML wrappers | Framework handles via `resolveFrameHtml()` |
| 5 | HTML error content | Return `<pre>Frame error: ...</pre>` |
| 6 | x-remix-frame header | Not needed — framework handles internally |
| 7 | Inherit render options | renderFragment delegates to render(), inherits all options |

## Unique Name Pattern

Each Frame in a list MUST have a unique `name` prop:

```tsx
// Grid: unique names per card
{allBooks.map((book) => (
  <Frame
    key={book.id}
    name={`book-card-${book.id}`}
    src={routes.fragments.bookCard.href({ bookId: book.id })}
  />
))}

// Card: unique name for cart button
<Frame
  name={`cart-button-${book.id}`}
  src={routes.fragments.cartButton.href({ bookId: book.id })}
/>
```

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

## Flow Summary

| Step | Action |
|------|--------|
| 1 | User visits `/books1` |
| 2 | Server renders page with books1-grid Frame |
| 3 | books1-grid loads `/fragments/books1-grid?page=1` |
| 4 | Grid renders card Frames for each book |
| 5 | Each card Frame loads `/fragments/book-card/:id` |
| 6 | Each card renders with nested cart button Frame |
| 7 | Button Frame loads `/fragments/cart-button/:id` |

## Related Files

| File | Purpose |
|------|---------|
| `bookstore/app/utils/render.tsx` | render(), renderFragment(), resolveFrame() |
| `bookstore/app/routes.ts` | Route definitions |
| `bookstore/app/controllers/fragments/controller.tsx` | Frame handlers |

## See Also

- [nested-frames-errors.md](../errors/nested-frames-errors.md) — Full error reference
- [render-utilities.md](../../../development/remix3/guides/render-utilities.md) — Render utilities guide
- [client-entry-in-paginated-lists.md](./guides/client-entry-in-paginated-lists.md) — Correct pattern for interactive elements
- [stale-props-after-pagination.md](../errors/stale-props-after-pagination.md) — Why nested client entries go stale
