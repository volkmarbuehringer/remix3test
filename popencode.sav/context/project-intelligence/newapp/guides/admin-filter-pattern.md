<!-- Context: project-intelligence/newapp/guides/admin-filter-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-22 -->

# Guide: Admin List Filter Pattern

**Purpose**: Standard pattern for building search/filter on admin list pages using raw SQL with GIN-indexed ILIKE on text + JSONB array content.

---

## Overview

Admin list pages need a text search that filters results client-side across both a `description` column and the item labels inside a JSONB `list` array. The pattern uses:

- `?filter=` query param (no hidden form fields needed — simple GET form)
- Raw SQL with `ILIKE` on text + `jsonb_array_elements()` + `ILIKE` on array fields
- `pg_trgm` GIN index on the `description` column for performance
- Parameterized `$N` placeholders — no SQL injection risk
- Filter preserved in pagination links and post-action redirects

---

## Controller Pattern

```ts
async index(context) {
  let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = context.url.searchParams.get('filter') || undefined

  if (filter) {
    if (filter.length > 200) filter = filter.slice(0, 200)  // abuse prevention
    let result = await pool.query(
      `SELECT * FROM lists WHERE description ILIKE $1
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(list) item WHERE item->>'label' ILIKE $1)
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [`%${filter}%`, PAGE_LIMIT + 1, offset],
    )
    // Fix BIGINT strings — raw SQL bypasses afterRead hook
    rows = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      created_at: typeof r.created_at === 'string' ? Number(r.created_at) : r.created_at,
      updated_at: typeof r.updated_at === 'string' ? Number(r.updated_at) : r.updated_at,
    }))
  } else {
    rows = await context.db.findMany(lists, {            // uses afterRead automatically
      limit: PAGE_LIMIT + 1, offset,
      orderBy: [['created_at', 'desc']] as const,
    })
  }
  hasMore = rows.length > PAGE_LIMIT
  if (hasMore) rows.pop()
}
```

When deleting, preserve filter in the redirect:

```ts
async destroy(context) {
  let params = new URLSearchParams()
  if (context.url.searchParams.get('offset')) params.set('offset', offset)
  if (context.url.searchParams.get('filter')) params.set('filter', filter)
  return new Response(null, { status: 302, headers: {
    Location: routes.admin.lists.index.href() + (params.toString() ? '?' + params.toString() : '')
  }})
}
```

---

## UI Pattern

A GET form submits to the same page. `defaultValue` preserves filter input (avoiding controlled/uncontrolled React conflicts). Clear link appears only when a filter is active:

```tsx
<form method="GET" action="/admin/lists" rmx-target={frames.adminContent}>
  <input type="text" name="filter" placeholder="Search by item label or description..."
         defaultValue={filter ?? ''} />
  <button type="submit">Search</button>
  {filter && <a href="/admin/lists" rmx-target={frames.adminContent}>Clear</a>}
</form>
```

Pagination links include `?filter=` — both "Newer" and "Older" links use `buildPaginationUrl(offset, filter)`. Empty state differentiates "no data" vs "no matching results":

```tsx
{lists.length === 0 ? (
  <div>{filter ? 'No lists found for this search.' : 'No lists saved yet.'}</div>
) : (/* table + pagination links */)}
```

---

## Database

### GIN Trigram Index

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_lists_desc ON lists USING GIN (description gin_trgm_ops);
```

Enables index-accelerated `ILIKE '%pattern%'` on `description`. Without it, every filtered query is a sequential scan. `gin_trgm_ops` splits text into 3-char trigrams → inverted index → `ILIKE` decomposed to trigram set intersection. See [Postgres GIN Indexing](../../development/postgres/concepts/indexing.md) for full breakdown.

### JSONB Array Search

`jsonb_array_elements()` unnests the JSONB `list` array, then `ILIKE` filters on `item->>'label'`. **Not GIN-indexed** (can't index a set-returning function). Acceptable because per-row arrays are typically small (<100 items).

---

## Consistent Pattern: nutzer vs lists

Both `admin-nutzer-controller.tsx` and `admin-lists-controller.tsx` use `?filter=` the same way: truncated to 200 chars, `$N` parameterized, `+1` pagination, filter preserved in links and post-action redirects. The key difference: nutzer's ILIKE is on plain text columns (sequential scan), while lists adds GIN-indexed `description` search + JSONB array item label search with manual BIGINT conversion.

---

## 📂 Codebase References

- **Lists controller**: `app/actions/admin-lists-controller.tsx` — GIN filter + raw SQL + BIGINT fix
- **Nutzer controller**: `app/actions/admin-nutzer-controller.tsx` — Multi-column ILIKE filter with raw SQL
- **Lists page**: `app/ui/admin-lists-page.tsx` — Filter form, pagination with filter, empty states
- **Routes**: `app/routes.ts` — `admin.lists` route tree (index + destroy)
- **Schema**: `app/data/schema.ts` — `lists` table with `afterRead` for BIGINT conversion
- **Setup**: `app/data/setup.ts` — `CREATE EXTENSION pg_trgm` + GIN index at lines 100-111
- **Tests**: `app/actions/lists-controller.test.ts` — 16 filter tests (description, item label, case-insensitive, empty state, Clear link, pagination preservation)

## Related

- [Database Architecture](../concepts/database-architecture.md) — `afterRead` hook, BIGINT handling
- [Raw SQL afterRead Error](../errors/raw-sql-bypasses-afterread.md) — The BIGINT string trap
- [Postgres GIN Indexing](../../development/postgres/concepts/indexing.md) — GIN trigram concepts
- [Known Issues](../lookup/known-issues.md) — afterRead bypass entry
