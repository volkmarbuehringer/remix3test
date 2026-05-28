<!-- Context: development/remix3/guides/pagination | Priority: high | Version: 2.0 | Updated: 2026-05-07 -->

# Guide: Pagination

**Core Idea**: Offset-based pagination with URL state for shareable/bookmarkable pages.

## Key Points

- **Offset-style**: Use `offset` param (not page) with `PAGE_SIZE` — simplifies manual fetch fragment swapping
- **Cursor-style**: Fetch `pageSize + 1` to detect `hasMore` without COUNT (recommended for large datasets)
- **Known total**: Use COUNT query for "Showing X to Y of Z" display
- **URL state**: Shareable/bookmarkable pages, combine with sort and filter params
- **Preservation**: Always preserve page/sort/filter in all navigation links

## Quick Example

```tsx
// Controller - offset-based with PAGE_SIZE
async index({ db, url }) {
  let offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  let pageNum = Math.floor(offset / PAGE_SIZE) + 1

  let { items: page, hasMore } = await paginate(db, table, {
    pageSize: PAGE_SIZE,
    page: pageNum,
    orderBy: [[column, direction]],
  })

  return { items: page, offset, hasPrev: offset > 0, hasMore }
}

// Links preserve state
<button data-pagination data-offset={offset - PAGE_SIZE} data-sort={sort} data-order={order}>
  ← Prev
</button>
<button data-pagination data-offset={offset + PAGE_SIZE} data-sort={sort} data-order={order}>
  Next →
</button>
```

## Page Bounds

```tsx
// Redirect to last valid page when empty
if (items.length === 0 && page > 1) {
  return redirect(`?page=${page - 1}&sort=${sort}`)
}
```

## Pagination with Filter

When combining pagination with a search filter, **changing the filter resets the offset to 0** (first page):

```typescript
// Client: filter change resets offset
function applyFilter(value: string) {
  fetchPage(0, currentSort, currentOrder, value)
}
```

All three params travel together in the URL or fetch query:

```
/grid?offset=0&sort=name&order=asc&filter=alice
```

## Related

- `guides/sorting.md` — Sorting patterns
- `guides/filtering.md` — Combined filter + pagination + sort
- `guides/manual-fetch-patterns.md` — Client-side fetch for pagination with smooth transitions