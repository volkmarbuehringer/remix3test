<!-- Context: frame-navigation/concepts | Priority: high | Version: 1.0 | Updated: 2026-03-21 -->

# URL-Based Filtering Pattern

Filters stored in URL query params for shareable/bookmarkable state across page reloads and browser history.

## Core Idea

Use `method="GET"` forms with filter params in URL. Controllers parse filters and build database predicates.

## Filter State Flow

```
URL (?q=search&type=announcement)
  → parseFilters(url)
  → buildFilterWhere(filters)
  → database query with predicates
  → render with active filters
```

## Key Components

| Component                   | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `parseFilters(url)`         | Extract filter params from URL into `FilterState` |
| `buildFilterWhere(filters)` | Build array of predicate functions                |
| `method="GET"` form         | Submit sends filter params in URL                 |
| `defaultValue` on inputs    | Pre-fill form with active filters                 |
| `selected` on options       | Mark selected option without SSR issues           |

## Filter Predicates

Use `remix/data-table` predicates:

```typescript
import { ilike, eq, or, and } from 'remix/data-table'

// Search across fields
if (filters.q) {
  predicates.push(or(ilike(table.title, `%${filters.q}%`), ilike(table.message, `%${filters.q}%`)))
}

// Exact match
if (filters.type) {
  predicates.push(eq(table.type, filters.type))
}
```

## Critical: Combine with `and()`

**Bug**: Predicates array alone won't work.

```typescript
// ❌ Wrong - returns array, not combined predicate
where: filterPredicates

// ✅ Correct - combine with and()
where: filterPredicates.length > 0 ? and(...filterPredicates) : undefined
```

## Reference

- `app/lib/admin-utils.ts` - `parseFilters()`, `FilterState`, `hasFilters()`
- `app/lib/controller-utils.ts` - `buildFilterWhere` in `CRUDConfig`
- `guides/filter-implementation.md` - Step-by-step guide
- `lookup/filter-utilities.md` - Function reference
- `errors/filter-bugs.md` - Common mistakes
