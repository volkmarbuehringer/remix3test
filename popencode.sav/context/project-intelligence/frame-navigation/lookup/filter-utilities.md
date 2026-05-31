<!-- Context: frame-navigation/lookup | Priority: high | Version: 1.0 | Updated: 2026-03-21 -->

# Filter Utilities Reference

Quick reference for filtering in `app/lib/admin-utils.ts`.

## Types

```typescript
interface FilterState {
  q?: string // Search query
  type?: string // Type filter
  read?: string // Read status filter
  category?: string
  difficulty?: string
}
```

## Parsing

| Function                     | Returns       | Use                            |
| ---------------------------- | ------------- | ------------------------------ |
| `parseFilters(url)`          | `FilterState` | Extract filter params from URL |
| `hasFilters(filters)`        | `boolean`     | Check if any filters active    |
| `buildFilterParams(filters)` | `string`      | Build query string for links   |

## Filter Predicates (remix/data-table)

```typescript
import { ilike, eq, or, and } from 'remix/data-table'
```

| Predicate                    | Use                   |
| ---------------------------- | --------------------- |
| `eq(table.col, value)`       | Exact match           |
| `ilike(table.col, '%text%')` | Case-insensitive LIKE |
| `or(pred1, pred2)`           | Combine with OR       |
| `and(pred1, pred2)`          | Combine with AND      |

## Examples

```typescript
// Build predicates from filters
buildFilterWhere: (filters) => {
  let predicates: any[] = []

  if (filters.q) {
    predicates.push(
      or(ilike(table.title, `%${filters.q}%`), ilike(table.message, `%${filters.q}%`)),
    )
  }
  if (filters.type) {
    predicates.push(eq(table.type, filters.type))
  }
  if (filters.read !== undefined) {
    predicates.push(eq(table.read, filters.read === 'true'))
  }

  return predicates
}
```

## CRUDConfig Extensions

```typescript
interface CRUDConfig {
  parseFilters?: (url: URL) => Record<string, string | undefined>
  buildFilterWhere?: (filters: Record<string, string | undefined>) => unknown[]
}
```

## Filter Form Pattern

```tsx
<form method="GET" action={listUrl}>
  <input type="search" name="q" defaultValue={filters?.q} />
  <select name="type" defaultValue={filters?.type || ''}>
    <option value="">All</option>
    <option value="announcement">Announcement</option>
  </select>
  <button type="submit">Filter</button>
  {hasFilters(filters) && <a href={clearUrl}>Clear</a>}
</form>
```

## CSS Classes

| Class             | Purpose                   |
| ----------------- | ------------------------- |
| `.filter-section` | Container for filter bar  |
| `.filter-form`    | Flex container for inputs |
| `.filter-search`  | Search input styling      |
| `.filter-select`  | Select dropdown styling   |

## Grids with Filters

| Grid                   | Filters                 |
| ---------------------- | ----------------------- |
| `/admin/notifications` | q, type, read           |
| `/admin/courses`       | q, category, difficulty |

## Reference

- `app/lib/admin-utils.ts` - Full implementation
- `app/lib/controller-utils.ts` - buildCRUDActions integration
- `concepts/filtering.md` - Pattern overview
- `errors/filter-bugs.md` - Common mistakes
