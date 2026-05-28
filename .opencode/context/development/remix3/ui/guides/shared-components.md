<!-- Context: development/remix3/guides/shared-components | Priority: medium | Version: 1.1 | Updated: 2026-04-12 -->

# Shared Pagination & Table Components

Reusable components for consistent admin UI.

## Core Concept

Create shared `Pagination` and `SortableTableHeader` components that handle URL building for pagination, sorting, and filtering consistently across admin pages.

---

## Key Points

- **Pagination**: Props for `baseUrl`, `page`, `hasMore`, `sort`, `filters`
- **URL building**: Helper function constructs URLs with all params
- **ARIA**: Include `aria-label` for accessibility
- **Link styling**: Disabled state with opacity

---

## Minimal Example

```typescript
// app/ui/pagination.tsx
import type { Handle } from 'remix/ui'

type PaginationProps = {
  baseUrl: string
  page: number
  hasMore: boolean
}

export function Pagination(handle: Handle<PaginationProps>) {
  return () => {
    let { baseUrl, page, hasMore } = handle.props
    let prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : '#'
    let nextUrl = hasMore ? `${baseUrl}?page=${page + 1}` : '#'

    return (
      <nav aria-label="Pagination">
        <a href={prevUrl}>Previous</a>
        <span>Page {page}</span>
        <a href={nextUrl}>Next</a>
      </nav>
    )
  }
}
```

---

## Reference

- Pagination guide: `guides/pagination.md`
- Sorting: `guides/sorting.md`
- Filtering: `guides/filtering.md`
