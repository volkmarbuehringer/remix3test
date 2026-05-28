<!-- Context: development/remix3/lookup/pagination-sorting-filtering | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Pagination, Sorting & Filtering

General patterns for URL-based data tables in Remix 3 with PostgreSQL/data-table.

## Concept

Combine pagination, sorting, and filtering using URL params for shareable/bookmarkable pages. Single query with `limit + 1` for hasMore detection.

## Key Points

- **URL state**: `?page=2&sort=title&dir=asc&q=search` for all navigation
- **Single query**: Fetch `pageSize + 1` rows to detect `hasMore` without COUNT
- **Filter persistence**: All links (pagination, sort, edit, delete) must preserve `q` param
- **Empty handling**: Redirect to page-1 when page > 1 returns empty results
- **Database sort**: Never sort in JavaScript - use `orderBy` in query

## Minimal Example

```typescript
// 1. FilterState interface
export interface FilterState { search: string }

// 2. Paginated result with isEmpty
export interface PaginatedItems {
  items: Item[]
  page: number
  pageSize: number
  hasMore: boolean
  isEmpty: boolean
}

// 3. Query with filter + sort + pagination
let predicates = filters.search ? [ilike(table.title, `%${filters.search}%`)] : []
let items = await db.findMany(table, {
  where: predicates.length ? and(...predicates) : undefined,
  orderBy: [[sort.column, sort.direction]] as any,
  limit: pageSize + 1,
  offset: (page - 1) * pageSize,
})
let hasMore = items.length > pageSize

// 4. Controller empty check
if (result.isEmpty && page > 1) {
  return redirect(buildPageUrl(baseUrl, page - 1, sort, filters))
}
```

## URL Builders (pagination.ts)

```typescript
export function buildSortUrl(baseUrl: string, column: string, sort: SortState, filters?: FilterState): string {
  let dir = sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc'
  let params = new URLSearchParams({ page: '1', sort: column, dir })
  if (filters?.search) params.set('q', filters.search)
  return `${baseUrl}?${params}`
}

export function buildPageUrl(baseUrl: string, page: number, sort: SortState, filters?: FilterState): string {
  let params = new URLSearchParams({ page: String(page), sort: sort.column, dir: sort.direction })
  if (filters?.search) params.set('q', filters.search)
  return `${baseUrl}?${params}`
}
```

## Reference

- Full guide: `guides/pagination.md`
- Filtering: `guides/filtering.md`
- Sorting: `guides/sorting.md`
