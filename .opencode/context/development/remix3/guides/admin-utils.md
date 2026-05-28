<!-- Context: development/remix3/guides/admin-utils | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Utilities

Centralized utilities for Remix controllers: error handling, pagination, and redirects.

## Error Handling
```typescript
export function handleValidationError(error: any, url: string): Response | undefined
export function handleForeignKeyError(error: any, listUrl: string, page?: string): Response | undefined
export function handleSqliteForeignKeyError(error: any, errorUrl: string, msg?: string): Response | undefined
export function handleDeleteError(error: any, listUrl: string, page: string, msg?: string): Response
export function toastRedirect(url: string, msg: string): Response
```

## Pagination
```typescript
export const PAGE_SIZE = 20
export function buildPageUrl(baseUrl: string, page: number): string
export function buildPaginationUrl(baseUrl: string, page: number, currentPage: number, hasMore: boolean): string
export function parsePage(url: URL): number
export function getPaginationInfo(currentPage: number, totalItems: number): { startItem; endItem; totalPages }
```

## Usage
```typescript
import { handleValidationError, handleSqliteForeignKeyError, toastRedirect, buildPaginationUrl } from '../lib/utils.ts'
async create({ db, request, url }) {
  let errorUrl = routes.items.new.href()
  try { await db.create(items, { ... }) }
  catch (error: any) {
    let result = handleValidationError(error, errorUrl)
    if (result) return result
    result = handleSqliteForeignKeyError(error, errorUrl, 'Item not found')
    if (result) return result
    throw error
  }
  return toastRedirect(routes.items.index.href(), 'Created')
}
```
- Error helpers reduce repetitive redirect logic
- `toastRedirect` combines redirect with success/error message
- `buildPaginationUrl` handles edge cases (bounds checking)

## Sorting Utilities
```typescript
export function parseSort(url: URL): SortState
export function buildSortUrl(base: string, column: string, currentSort: SortState): string
export function buildSortPageUrl(base: string, page: number, currentSort: SortState): string
export function buildEditLinkParams(page: number, sort?: SortState): string
```

## Quick Edit Pattern
URL-based modal trigger: `<a href={\`${baseUrl}?page=${page}&sort=${col}&dir=${dir}&quickEdit=${item.id}\`}>Quick Edit</a>`
Controller parses: `let quickEditId = url.searchParams.get('quickEdit')`

## Edit/Delete Back URL Pattern
```typescript
export function buildBackUrlWithFilters(baseUrl: string, page: number, sort: SortState, filters: FilterState): string {
  let params = new URLSearchParams()
  params.set('page', String(page))
  if (sort?.column) { params.set('sort', sort.column); params.set('dir', sort.direction) }
  if (filters.search) params.set('q', filters.search)
  if (filters.genre) params.set('genre', filters.genre)
  return `${baseUrl}?${params.toString()}`
}
function buildEditUrl(bookId, page, sort, filters) {
  let backUrl = buildBackUrlWithFilters(baseUrl, page, sort, filters)
  let editUrl = routes.admin.books.edit.href({ bookId })
  return `${editUrl}?back=${encodeURIComponent(backUrl)}`
}
```
- Edit form uses hidden field `<input type="hidden" name="back" value={backUrl} />` to pass through POST
- Controller redirects: `formData.get('back')?.toString() ?? routes.admin.books.index.href()`

**Reference**: `checker/app/controllers/admin/books/grid.tsx`, `checker/app/controllers/admin/books/edit-page.tsx`

## Related
- lookup/admin-files.md (file locations)
- errors/form-hydration.md (partial update validation)
