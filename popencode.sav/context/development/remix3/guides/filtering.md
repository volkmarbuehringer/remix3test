<!-- Context: development/remix3/guides/filtering | Priority: high | Version: 2.0 | Updated: 2026-05-07 -->

# Guide: Filtering

**Core Idea**: URL-based filtering for shareable/bookmarkable search. Use `selected` attribute for SSR-safe selects.

## Key Points

- **SSR text input**: Use `value` NOT `defaultValue` (doesn't render in HTML)
- **SSR select**: Use `selected` attribute, NOT `value`
- **URL state**: Shareable/bookmarkable searches
- **Filter preservation**: All links must preserve filter params
- **Type workaround**: Use `as any` for heterogeneous predicates

## Quick Example

```tsx
// Form - use selected for SSR
<form method="GET" action={routes.posts.href()}>
  <input type="search" name="q" value={filters.search} placeholder="Search..." />
  <select name="status">
    <option value="" selected={!status}>All</option>
    <option value="published" selected={status === 'published'}>Published</option>
  </select>
</form>

// Controller
import { ilike, eq, and, or } from 'remix/data-table'

let predicates = []
if (search) predicates.push(or(ilike(posts.title, `%${search}%`)))
if (status) predicates.push(eq(posts.status, status))

let items = await db.findMany(posts, {
  where: predicates.length > 0 ? and(...predicates) : undefined,
})
```

## Filter Preservation

```tsx
let filterQs = filters.search ? `&q=${encodeURIComponent(filters.search)}` : ''
href={`${routes.edit.href({ id })}?page=${page}&sort=${sort}${filterQs}`}
```

## Combined Filter + Pagination + Sort

When filtering a paginated, sortable grid, all three concerns combine in a single database query:

```typescript
async function loadGridData(url: URL, db: Database, table: Table) {
  let filter = url.searchParams.get('filter') || ''
  let offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  let pageNum = Math.floor(offset / PAGE_SIZE) + 1
  let { column, direction } = parseSort(url, {
    allowedColumns: ['name', 'email', 'role', 'status'],
    defaultColumn: 'id',
    defaultDirection: 'asc',
  })

  let where = filter
    ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
    : undefined

  return await paginate(db, table, {
    pageSize: PAGE_SIZE,
    page: pageNum,
    orderBy: [[column, direction]],
    where,
  })
}
```

### Filter Resets Offset

When the user changes the filter, the offset must reset to 0 (first page). Client-side, this means:

```typescript
function applyFilter(filterValue: string): void {
  // Reset to page 1 when filter changes
  fetchPage(0, currentSort, currentOrder, filterValue)
}
```

Server-side, the URL is constructed to reflect all three params:

```
/client/grid?offset=0&sort=name&order=asc&filter=alice
```

### Benefits of Combined Query

- Single round trip instead of separate count + data queries
- Consistent ordering — sort is applied at the DB level before pagination
- Backend handles WHERE clause composition; client simply passes params

## Reference

- `guides/pagination.md` — Offset-based pagination patterns
- `guides/sorting.md` — Column sorting patterns
- `guides/manual-fetch-patterns.md` — Client-side fetch for smooth UX transitions