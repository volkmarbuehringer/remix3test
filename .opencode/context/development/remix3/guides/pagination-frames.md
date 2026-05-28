# Guide: Pagination with Frames

**Core Idea**: Use nested Frame for paginated content to preserve client-side state.

## Why Standard Pagination Breaks

URL query params (`?page=2`) cause full page navigation → Frame components lose client-side state (add-to-cart buttons reset).

## Solution: Nested Frame

```
/books (parent page - stable)
└── <Frame src="/fragments/books-grid?page=N" /> (paginates internally)
```

## Implementation

```tsx
// Parent page
<Frame src={routes.fragments.booksGrid.href({ page: 1 })} />

// Fragment controller
async content({ request }) {
  let page = parseInt(url.searchParams.get('page') ?? '1', 10)
  let books = await db.book.findMany({ take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE })
  let hasMore = books.length > PAGE_SIZE
  return <BooksGrid books={books.slice(0, PAGE_SIZE)} page={page} hasMore={hasMore} />
}
```

## Key Points

- Parent page URL may change, but Frame navigates internally
- Client components (add-to-cart) stay alive
- Items inside the paginated grid must use `clientEntry`, not `<Frame>` — see scaling constraints
- **Identity tracking**: clientEntry components must track `lastId` to reset state on page change — see `errors/component-instance-reuse.md`
- Reference: `.opencode/context/development/remix3/ui/guides/frame-scaling.md`
- Reference: `.opencode/context/development/remix3/ui/guides/cart-button-local-state.md`
- Reference: `.opencode/context/development/remix3/ui/concepts/frame-vs-client-entry.md`