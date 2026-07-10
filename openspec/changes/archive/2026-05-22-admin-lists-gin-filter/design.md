## Context

The `/admin/lists` page displays saved list snapshots in a paginated table. Currently there is no way to search or filter. The `list` column is `JSONB` storing an array of `{id, label}` objects; `description` is plain `TEXT`. The only data access is `findMany(lists, ...)` with no `where` clause.

The nutzer controller already demonstrates the pattern: a `?filter=` query param, raw SQL with `ILIKE`, and a form in the page component with `rmx-target` for frame-based navigation.

## Goals / Non-Goals

**Goals:**

- Allow filtering lists by partial match on item labels and description text
- Use GIN indexes to keep the query fast as the table grows
- Follow the existing nutzer controller pattern (text input, `?filter=` param, frame navigation)
- Preserve filter state across pagination and delete actions

**Non-Goals:**

- Filtering by any other columns (ID, timestamps)
- Regex or advanced search operators
- Debounced/autocomplete client-side filtering (plain form submit like nutzer)

## Decisions

### Decision 1: Raw SQL over data-table for filtered queries

The `data-table` abstraction doesn't expose `ILIKE` or JSONB containment queries. Following the nutzer pattern, we write raw SQL via `pool.query()` when a filter is present. For unfiltered queries, we keep using `db.findMany()`.

### Decision 2: Two GIN indexes (Option A from exploration)

Using `jsonb_path_ops` for the JSONB column and `gin_trgm_ops` for description:

```sql
CREATE INDEX idx_lists_list ON lists USING GIN (list jsonb_path_ops);
CREATE INDEX idx_lists_desc ON lists USING GIN (description gin_trgm_ops);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- `jsonb_path_ops` is smaller/faster than default `jsonb_ops` and the `?`/`?|` ops aren't needed.
- GIN trigram support partial ILIKE matches on description with index scans.
- The query uses `jsonb_array_elements()` with ILIKE for partial label matching (sequential scan on the array, but array sizes are small).

### Decision 3: Combined query with OR

```sql
SELECT * FROM lists
WHERE description ILIKE $1
   OR EXISTS (
     SELECT 1 FROM jsonb_array_elements(list) item
     WHERE item->>'label' ILIKE $1
   )
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

The nutzer controller uses a simpler `ILIKE ANY(ARRAY[...])` pattern across text columns. We can't do that with JSONB, so we use the EXISTS subquery instead.

### Decision 4: Filter preserved across pagination and deletes

Same pattern as nutzer: the filter value flows through `?filter=` param in pagination links and delete redirects.

## Risks / Trade-offs

- **[Performance] `jsonb_array_elements()` with ILIKE on large arrays**: The EXISTS subquery iterates the JSONB array for each row. Lists typically hold 10–50 items, so this is fast. If lists grow to 1000+ items, consider extracting labels to a `TEXT[]` column.
- **[Index maintenance] Two new GIN indexes**: GIN indexes are larger and slower to write than B-tree. The `lists` table is write-light (created by saves, deleted individually), so this is acceptable.
- **[No GIN for partial JSONB match]**: GIN's `@>` only does exact containment. Partial label matching requires the array iteration. This is the accepted trade-off of Option A.
