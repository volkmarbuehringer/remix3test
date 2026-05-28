# Guide: Admin URL Params Pattern

**Core Idea**: URL params for sort/page must be passed through forms via hidden fields since POST loses query params. Use guards for optional params. **Filters must also be preserved in all navigation.** Use `backUrl` query param for edit/delete redirects.

**Key Points**:

- `buildEditLinkParams(page, sort)` requires `page: number` - not optional
- Guard calls: `page !== undefined && sortColumn ? ... : ''`
- POST forms need hidden fields for page/sort/dir/filters
- GET links embed params directly in URL
- `backUrl` extracts query string for form action URL
- All links (sort, pagination, edit, delete) must preserve filter params
- **Edit/Delete**: Use `buildBackUrlWithFilters` for backUrl with state preservation
- **Hidden 'back' field**: Use in edit/update forms to preserve return URL

**Quick Example**:

```typescript
// Guard buildEditLinkParams
let params = page !== undefined && sortColumn
  ? buildEditLinkParams(page, {
      column: sortColumn,
      direction: sortDir ?? 'desc'
    })
  : ''

// Hidden fields for POST (include filters!)
<input type="hidden" name="page" value={page ?? 1} />
<input type="hidden" name="sort" value={sortColumn} />
<input type="hidden" name="dir" value={sortDir ?? 'desc'} />
<input type="hidden" name="q" value={filters.search} />
<input type="hidden" name="genre" value={filters.genre} />

// Hidden 'back' field for edit form redirect after submit
<input type="hidden" name="back" value={`?page=${page}&sort=${sortColumn}&dir=${sortDir}&q=${filters.search}`} />

// GET link with filters
let filterQs = buildFilterQs(filters)
<a href={`${editUrl}?${params}${filterQs}`}>Edit</a>
```

**Filter Utilities** (in admin/utils.ts):

```typescript
// Parse filters from URL
export function parseFilter(url: URL): FilterState {
  return {
    search: url.searchParams.get('q')?.trim() ?? '',
    role: url.searchParams.get('role') ?? '',
    status: url.searchParams.get('status') ?? '',
  }
}

// Build query string for filters
export function buildFilterQs(filters: FilterState): string {
  let params: string[] = []
  if (filters.search) params.push(`q=${encodeURIComponent(filters.search)}`)
  if (filters.role) params.push(`role=${encodeURIComponent(filters.role)}`)
  if (filters.status) params.push(`status=${encodeURIComponent(filters.status)}`)
  return params.length > 0 ? `&${params.join('&')}` : ''
}

// Build back URL with all state
export function buildBackUrlWithFilters(
  baseUrl: string,
  page: number,
  sort: SortState,
  filters: FilterState
): string {
  let url = new URL(baseUrl)
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort', sort.column)
  url.searchParams.set('dir', sort.direction)
  if (filters.search) url.searchParams.set('q', filters.search)
  if (filters.role) url.searchParams.set('role', filters.role)
  if (filters.status) url.searchParams.set('status', filters.status)
  return url.toString()
}
```

**Users/Orders Entity Config**:

```typescript
// admin/utils.ts - Entity sort columns
export const ENTITY_SORT_COLUMNS = {
  books: ['id', 'title', 'author', 'genre', 'price', 'created_at'],
  users: ['id', 'name', 'email', 'role', 'created_at'],
  orders: ['id', 'total', 'status', 'created_at'],
} as const
```

**Reference**: `context/development/remix3/guides/pagination.md`, `context/development/remix3/guides/filtering.md`, `context/development/remix3/guides/sorting.md`

**Related**: `development/remix3/concepts/client-entry-typing.md`, `development/remix3/errors/client-entry-props.md`, `development/remix3/errors/decimal-display.md`
