<!-- Context: bookstore-demo/lookup/admin-books-fsp | Priority: high | Version: 1.1 | Updated: 2026-04-23 -->

# Admin Books: Filter/Sort/Pagination Implementation

**Purpose**: Reference patterns for the /admin/books page with URL-based filter, sort, and pagination state.

## Core Concept

The admin books page uses URL search params for shareable/bookmarkable state:
- `?page=X` - Current page (default: 1)
- `?sort=column` - Sort column (default: id)
- `?dir=asc|desc` - Sort direction (default: asc)
- `?q=search` - Search query (title/author filter)
- `?genre=genre` - Genre filter

## Key Points

- URL state persists across navigation (edit, create, delete → back preserves page/sort/filter)
- Uses Remix 3's URL pattern for state management
- Sort columns are whitelisted (ENTITY_SORT_COLUMNS) to prevent injection
- Pagination info shows "Showing X to Y of Z books"
- Edit/delete actions preserve back URL for return navigation

## Types (in utils.ts)

```typescript
// Sort state
export interface SortState {
  column: string | null
  direction: 'asc' | 'desc'
}

// Filter state
export interface FilterState {
  search: string
  genre?: string
}

// Constants
export const DEFAULT_PAGE_SIZE = 15
export const MAX_PAGE_SIZE = 100

// Valid sort columns (whitelist)
export const ENTITY_SORT_COLUMNS = {
  books: ['id', 'title', 'author', 'price', 'genre'] as const,
}
```

## URL Parsing Functions

```typescript
// Parse page from URL (default: 1)
export function parsePage(url: URL): number

// Parse sort with whitelist validation
export function parseSort(url: URL, validColumns?: readonly string[]): SortState

// Parse filter state
export function parseFilter(url: URL): FilterState

// Get pagination display info
export function getPaginationInfo(currentPage, totalItems, pageSize?): { startItem, endItem, totalPages }
```

## URL Building Functions

```typescript
// Toggle sort direction or set new column
export function buildSortUrl(baseUrl, column, currentSort): string

// Build URL with page and sort
export function buildSortPageUrl(baseUrl, page, currentSort): string

// Build back URL with page and sort (for edit/delete)
export function buildBackUrl(baseUrl, page?, sort?): string

// Build back URL with full filter state
export function buildBackUrlWithFilters(baseUrl, page, sort, filters): string

// Build edit link params for navigation
export function buildEditLinkParams(page, sort?): string

// Build URL with pagination
export function buildPageUrl(baseUrl, page, currentSort?, filters?): string

// Safe pagination (handles bounds)
export function buildPaginationUrl(baseUrl, page, currentPage, totalPages): string

// Combined sort + filter URL
export function buildSortFilterUrl(baseUrl, column, currentSort, filters?): string

// Combined page + filter URL
export function buildPageFilterUrl(baseUrl, page, currentSort, filters): string

// Build redirect with all state (for controller redirects)
export function buildRedirectUrl(baseUrl, page, sort, filters): string

// Build filter query string only
export function buildFilterQs(filters): string
```

## URL State Preservation

When navigating from index to edit/form:
```typescript
// Build backUrl with all state
backUrl = buildBackUrlWithFilters(baseUrl, page, sort, filters)
<Link href={`${routes.edit.href({ id })}?${buildEditLinkParams(page, sort)}`}>
```

## UI Components

### Pagination (pagination.tsx)
- Reusable component with Previous/Next buttons
- Shows current page and total pages
- Disabled state when at bounds

### Sortable Table Headers (table.tsx)
- SortableTH component with indicators:
  - `↑` - ascending sort
  - `↓` - descending sort
  - `⇅` - no sort (default)
- Click toggles direction or changes column

## Related Files

- **Pagination UI**: `bookstore/app/ui/pagination.tsx`
- **Table UI**: `bookstore/app/ui/table.tsx` (sortable headers)
- **Utils**: `bookstore/app/controllers/admin/utils.ts`
- **Books grid**: `bookstore/app/controllers/admin/books/grid.tsx`
- **Books controller**: `bookstore/app/controllers/admin/books/controller.tsx`
- **Books page**: `bookstore/app/controllers/admin/books/index-page.tsx`
- **Books form**: `bookstore/app/controllers/admin/books/form.tsx`

## Generic Patterns (from development/)

- [pagination.md](../development/remix3/guides/pagination.md) - Pagination patterns
- [sorting.md](../development/remix3/guides/sorting.md) - Sorting patterns
- [filtering.md](../development/remix3/guides/filtering.md) - Filtering patterns

## Codebase References

| File | Purpose |
|------|---------|
| `bookstore/app/controllers/admin/utils.ts` | Complete URL utilities + types |
| `bookstore/app/ui/pagination.tsx` | Pagination component |
| `bookstore/app/ui/table.tsx` | Sortable table headers |
| `bookstore/app/controllers/admin/books/controller.tsx` | FSP logic in index action |
| `bookstore/app/controllers/admin/books/index-page.tsx` | Filter form + table UI |
| `bookstore/app/controllers/admin/books/grid.tsx` | Grid with edit/delete + back URL |
| `bookstore/app/controllers/admin/books/form.tsx` | Hidden back URL field |
| `bookstore/app/data/setup.ts` | 47 seed books |