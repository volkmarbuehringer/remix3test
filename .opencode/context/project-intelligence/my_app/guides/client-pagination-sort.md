<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 2.1 | Updated: 2026-05-06 -->

# Guide: Client Pagination & Sort State Management

**Purpose**: Document the pagination and sort architecture using shared server utilities (`paginate()`, `parseSort()`) and URL-based sort state (replacing module-level `currentSort`/`currentOrder` closures).

---

## Server-Side Utilities

### `paginate()` — `app/utils/pagination.ts`

Cursor-style `pageSize + 1` hasMore detection (no `COUNT` query):

```typescript
let { items: page, hasMore } = await paginate(db, clients, {
  pageSize: 20,
  page: pageNum,           // 1-indexed
  orderBy: [[column, direction]],
})
```

Returns `{ items, page, hasMore }` — items always ≤ pageSize. Accepts optional `where` filter.

### `parseSort()` — `app/utils/sort-params.ts`

Validates sort/order from URL search params:

```typescript
let { column, direction } = parseSort(url, {
  allowedColumns: SORTABLE_FIELDS,
  defaultColumn: 'id',
  defaultDirection: 'asc',
})
```

Falls back to `defaultColumn` if sort param invalid. Falls back to `defaultDirection` if order not `'asc'`/`'desc'`.

---

## Controller Integration

Both `index` and `grid` actions use shared utilities:

```typescript
const SORTABLE_FIELDS = ['name', 'email', 'role', 'status', 'registered'] as const

async index({ url }) {
  let offsetNum = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  let { column, direction } = parseSort(url, {
    allowedColumns: SORTABLE_FIELDS, defaultColumn: 'id', defaultDirection: 'asc',
  })
  let { items: page, hasMore } = await paginate(db, clients, {
    pageSize: 20, page: Math.floor(offsetNum / 20) + 1, orderBy: [[column, direction]],
  })
}
```

**Benefits**: No manual sort validation. `hasMore` without `COUNT`. Both utilities unit-tested.

---

## Client-Side Sort: URL-Based State

**Old** (removed): Module-level `currentSort`/`currentOrder` closures.

**New**: Sort state read from URL params via `getParamsFromClick()`:

```typescript
function getParamsFromClick(target: HTMLElement): { sort: string; order: string } {
  let params = new URLSearchParams(window.location.search)
  return { sort: params.get('sort') || '', order: params.get('order') || 'asc' }
}

// Sort toggle: read current from URL, toggle direction
document.addEventListener('click', (e) => {
  let th = (e.target as HTMLElement).closest('[data-sortable]') as HTMLElement | null
  if (!th) return
  let field = th.getAttribute('data-field'); if (!field) return
  let { sort: s, order: o } = getParamsFromClick(th)
  let newSort = (field === s) ? s : field
  let newOrder = (field === s && o === 'asc') ? 'desc' : 'asc'
  fetchPage(0, newSort, newOrder)
})
```

**Why URL-based**: Survives page reloads. No drift between URL bar and client state.

---

## Pagination Buttons: `data-sort`/`data-order`

Buttons in `grid-page.tsx` carry sort state as server-rendered `data-*` attributes:

```tsx
<Button tone="secondary" data-pagination="true" data-offset={offset - 20}
  data-sort={sortField || ''} data-order={sortOrder || 'asc'} disabled={!hasPrev}>
  ← Prev
</Button>
```

Client pagination handler reads them directly — no closure dependencies:

```typescript
document.addEventListener('click', (e) => {
  let btn = (e.target as HTMLElement).closest('[data-pagination]') as HTMLElement | null
  if (!btn) return
  let offset = btn.getAttribute('data-offset'); if (offset === null) return
  let sort = btn.getAttribute('data-sort') || ''
  let order = btn.getAttribute('data-order') || 'asc'
  fetchPage(Number(offset), sort || undefined, order || undefined)
})
```

All handlers (pagination, sort, edit, delete) sync via same DOM attributes.

---

## `fetchPage()` Signature

```typescript
function fetchPage(offset: number, sort?: string, order?: string): void
```

Appends `?offset=N&sort=X&order=Y` to `/client/grid` fetch. Replaces `#client-grid-content` innerHTML with parsed response. Shows opacity fade loading state during fetch. See `grid-client.ts` for full implementation.

---

## ⚠️ Embedded Frame Constraint

`handle.frames.top.reload()` is **not compatible** with embedded Frames (Frame components rendered inside a page layout). This method triggers Remix's full document reload path, which inserts a new `<html>` element into the DOM — violating the single-`<html>` constraint of the parent Document.

For embedded Frames (like the client grid), always use the `fetchPage()` pattern documented above. See [Embedded Frame Reload Gotcha](../errors/embedded-frame-reload-gotcha.md) for full details.

---

## Raw SQL Pagination (Limit/Offset)

For admin routes using raw SQL (`db.exec()`), append `LIMIT`/`OFFSET` directly to queries instead of using `paginate()`:

```typescript
// app/utils/admin.ts
const PAGE_SIZE = 5

let offset = (page - 1) * PAGE_SIZE
let rows = db.exec(sql`
  SELECT * FROM conversations
  ${sql`LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`}
`)

let hasMore = rows.length > PAGE_SIZE
rows = rows.slice(0, PAGE_SIZE)
```

### The `sql` Tagged Template with Nested Fragments

The `sql` tagged template from `remix/data-table` supports nested conditional fragments using `${sql`...`}` interpolation:

```typescript
let limit = PAGE_SIZE + 1
let rows = db.exec(sql`
  SELECT * FROM conversations
  ${filter ? sql`WHERE content LIKE ${'%' + filter + '%'}` : sql``}
  ORDER BY created_at DESC
  ${sql`LIMIT ${limit} OFFSET ${offset}`}
`)
```

Benefits of nested fragments:
- **Conditional WHERE**: Include/exclude filter clauses without string concatenation
- **Safe interpolation**: Values in `${sql`...`}` are parameterized, not string-interpolated
- **Readable**: No manual spacing or `AND`/`WHERE` management

### `getAllConversations` Utility Pattern

The `getAllConversations` helper accepts optional `limit`/`offset` params, validated with `Number.isFinite()`:

```typescript
export function getAllConversations(
  filter?: string,
  limit?: number,
  offset?: number,
) {
  return db.exec(sql`
    SELECT * FROM conversations
    ${filter ? sql`WHERE content LIKE ${'%' + filter + '%'}` : sql``}
    ORDER BY created_at DESC
    ${Number.isFinite(limit) ? sql`LIMIT ${limit} OFFSET ${offset ?? 0}` : sql``}
  `)
}
```

The `Number.isFinite()` guard prevents SQL errors when params are `undefined`.

### Page Parameter Handling

```typescript
// Controller
async index({ url }) {
  let page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  let offset = (page - 1) * PAGE_SIZE

  let conversations = await getAllConversations(
    url.searchParams.get('filter') || undefined,
    PAGE_SIZE + 1,
    offset,
  )

  let hasMore = conversations.length > PAGE_SIZE
  conversations = conversations.slice(0, PAGE_SIZE)

  return { conversations, page, hasMore, filter: url.searchParams.get('filter') || '' }
}
```

### Comparison: `paginate()` vs Raw SQL

| Approach | Used For | hasMore Detection |
|----------|----------|-------------------|
| `paginate(db, table, opts)` | `db.findMany()` ORM-style calls | Built-in (`pageSize + 1`) |
| Raw `LIMIT n+1 OFFSET o` | `db.exec(sql\`...\`)` custom queries | Manual slice check |

### Navigation

Pagination controls use `rmx-target="admin-content"` for frame-scoped navigation:

```tsx
// Server-rendered pagination bar
<nav aria-label="Pagination">
  {page > 1 ? (
    <a href={pageHref(page - 1)} rmx-target="admin-content">← Previous</a>
  ) : (
    <span style={{ opacity: 0.5, pointerEvents: 'none' }}>← Previous</span>
  )}
  <span>Page {page}</span>
  {hasMore ? (
    <a href={pageHref(page + 1)} rmx-target="admin-content">Next →</a>
  ) : (
    <span style={{ opacity: 0.5, pointerEvents: 'none' }}>Next →</span>
  )}
</nav>
```

See `development/remix3/guides/pagination-bar-rmx-target.md` for the full pattern.

---

## Codebase References

- `my_app/app/utils/pagination.ts` — paginate() utility (35 lines)
- `my_app/app/utils/sort-params.ts` — parseSort() utility (29 lines)
- `my_app/app/utils/pagination.test.ts` — 4 tests
- `my_app/app/utils/sort-params.test.ts` — 6 tests
- `my_app/app/actions/client/controller.tsx` — index + grid use paginate()/parseSort()
- `my_app/app/assets/grid-client.ts` — getParamsFromClick(), sort/pagination handlers
- `my_app/app/actions/client/grid-page.tsx` — buttons with data-sort/data-order
- `my_app/app/controllers/admin/lists/controller.tsx` — Raw SQL pagination with LIMIT/OFFSET
- `my_app/app/controllers/admin/chatlog/controller.tsx` — Raw SQL pagination with filter
- `my_app/app/utils/admin.ts` — getAllConversations with optional limit/offset
- `my_app/app/utils/pagination-raw-sql.test.ts` — Raw SQL pagination tests

## Related

- [Inline Editing Patterns](./inline-editing-patterns.md) — Full client interactivity guide
- [Client Route Layout](./client-route-layout.md) — 50/50 split layout context
- [Delete Confirmation Pattern](./delete-confirmation-pattern.md) — Delete handler reads data-sort/data-order
- [Admin Action Button Pattern](./admin-action-button-pattern.md) — Admin interactive buttons
- `development/remix3/guides/pagination.md` — General pagination patterns
- `development/remix3/guides/pagination-bar-rmx-target.md` — Pagination bar with rmx-target frame nav
- `development/remix3/guides/pagination-frames.md` — Pagination with nested Frame approach
- `development/remix3/guides/manual-fetch-patterns.md` — Manual fetch pagination alternative
