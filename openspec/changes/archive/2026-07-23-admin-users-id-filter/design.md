## Context

The `/admin/users` page uses a `?filter=` query parameter in three modes:

```
?filter=          → no predicate (all users)
?filter=enabled   → disabled_at IS NULL
?filter=disabled  → disabled_at IS NOT NULL
?filter=<text>    → OR(ilike(name, '%<text>%'), ilike(email, '%<text>%'))
```

The filter is read in the controller's `index` action (`app/actions/admin/users/controller.tsx:76`) and translated to a predicate at lines 84-91.

## Goals / Non-Goals

**Goals:**

- When the filter value is purely numeric, treat it as an exact ID match (`id = N`)
- Update the search input placeholder to hint at ID search

**Non-Goals:**

- No changes to the filter tab behavior (Alle/Aktiv/Deaktiviert)
- No multi-param filter system
- No changes to pagination, sorting, or any other grid functionality
- No schema changes

## Decisions

### 1. Pure numeric heuristic for ID lookup

**Decision**: If `filter` matches `/^\d+$/`, use `{ id: Number(filter) }` as the `where` predicate, bypassing the ILIKE search.

**Rationale**: An ID is a unique identifier — it either finds exactly one user or none. Combining it with status filters or text search is meaningless because the result is already deterministic. This keeps the heuristic simple and the code minimal.

**Edge cases considered**:
- User with name `"42"` or email `"42@example.com"` becomes unfindable by text search. In practice this is virtually nonexistent. If it becomes a problem, the input can be refined to only treat it as an ID when the numeric value doesn't exceed the current max ID — but this adds a query and complexity for no practical benefit.
- Leading zeros (`"042"`) → `Number("042")` = `42`. Same result. Acceptable.
- The existing `enabled`/`disabled` string literals are correctly not numeric, so no collision.

### 2. ID lookup is exclusive, not additive

**Decision**: When the numeric ID filter is active, the status tabs (Alle/Aktiv/Deaktiviert) still replace the filter entirely on click. No attempt to preserve the ID filter alongside a tab switch.

**Rationale**: See above — an ID lookup is singular. Combining it adds complexity with no real use case. The admin who typed an ID and then clicks a tab is starting a new query.
