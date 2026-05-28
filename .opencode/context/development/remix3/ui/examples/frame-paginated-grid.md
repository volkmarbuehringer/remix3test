<!-- Context: development/remix3/ui/examples | Priority: high | Version: 1.0 | Updated: 2026-05-09 -->

# Example: Frame-Paginated Grid with Cart Interaction

**Purpose**: Demonstrate ONE Frame for paginated data + clientEntry for per-item cart buttons, avoiding the 50-frame cascade limit.

## Architecture

```
Page Shell
  └── Frame src="/fragments/grid?page=1"  ← ONE Frame (data boundary)
       ├── Pagination (clientEntry)        ← pagination controls
       ├── BookCard (server-rendered)
       │   └── CartButton (clientEntry)    ← per-item interaction
       ├── BookCard + CartButton
       └── ... × PAGE_SIZE
```

## Fragment Controller

```tsx
// app/actions/fragments/controller.tsx
async books1Grid({ get, url }) {
  let db = get(Database)
  let page = parseInt(url.searchParams.get('page') ?? '1', 10)
  let pageSize = 6
  let total = await db.count(books)
  let totalPages = Math.max(1, Math.ceil(total / pageSize))
  let books = await db.findMany(books, { orderBy: ['id', 'asc'], limit: pageSize, offset: (page - 1) * pageSize })
  let cart = getCurrentCart()
  return renderFragment(<div>
    <Pagination currentPage={page} totalPages={totalPages} />
    <div class="grid">{books.map((b) => <BookCard book={b} inCart={cart.items.some(i => i.bookId === b.id)} />)}</div>
  </div>)
}
```

## Page Shell

```tsx
<Frame src={routes.fragments.booksGrid.href({ page: 1 })} />
```

## Key Points

- **Frame count = 1** regardless of page size
- **clientEntry cart buttons** — zero sub-frames, no cascade risk
- **Pagination is clientEntry** — calls `handle.frame.reload()`
- **CartButton tracks `lastId`** — resets state when item identity changes

## Verified

| Scenario | Frame Count | Safe? |
|----------|-------------|-------|
| 100 books, 6/page (17 pages) | 1 | ✅ |
| Cart toggle | 0 new frames | ✅ |
| Page change | 0 new (reuses existing) | ✅ |

## Related

- `concepts/frame-vs-client-entry.md` — Decision matrix
- `guides/cart-button-local-state.md` — Cart button implementation
- `errors/component-instance-reuse.md` — Identity tracking fix

## 📂 Codebase References

**Implementation**:
- `pppookstore.sav/app/actions/fragments/controller.tsx` — books1Grid action
- `pppookstore.sav/app/assets/pagination.tsx` — Pagination clientEntry
- `pppookstore.sav/app/assets/cart-button.tsx` — CartButton with lastId tracking
- `pppookstore.sav/app/ui/book-card.tsx` — BookCard component
