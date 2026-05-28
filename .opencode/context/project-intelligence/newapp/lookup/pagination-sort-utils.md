<!-- Context: project-intelligence/newapp/lookup/pagination-sort-utils | Priority: medium | Version: 1.0 | Updated: 2026-05-12 -->

# Lookup: Pagination & Sort Utilities

Quick reference for the `paginate()` and `parseSort()` utilities in `app/utils/`.

---

## `paginate(db, table, options)`

File: `app/utils/pagination.ts`

### Signature

```ts
paginate<Row>(db, table, {
  pageSize: number
  page: number        // 1-indexed page number
  orderBy: [string, 'asc' | 'desc'][]
  where?: Record<string, unknown>
}): Promise<{ items: Row[], page: number, hasMore: boolean }>
```

### Algorithm

Fetches `pageSize + 1` rows. If the result has more than `pageSize`, there is a next page (`hasMore = true`). The extra row is sliced off before returning.

### Usage

```ts
let { items, hasMore } = await paginate(db, clients, {
  pageSize: 20,
  page: pageNum,
  orderBy: [['name', 'asc']],
  where: filterPredicate,
})
```

### Notes

- `page` is 1-indexed; converts to `offset = (page - 1) * pageSize`
- `hasMore` is boolean only — no total count query
- Cast result with `<Row>` type for type safety

---

## `parseSort(url, options)`

File: `app/utils/sort-params.ts`

### Signature

```ts
parseSort(url, {
  allowedColumns: readonly string[]
  defaultColumn?: string
  defaultDirection?: 'asc' | 'desc'
}): { column: string, direction: 'asc' | 'desc' }
```

### Usage

```ts
let { column, direction } = parseSort(url, {
  allowedColumns: ['name', 'email', 'role', 'status', 'registered'],
  defaultColumn: 'id',
  defaultDirection: 'asc',
})
```

### Behavior

1. Reads `?sort=` and `?order=` from URL
2. If `sort` value is in `allowedColumns`, uses it; otherwise falls back to `defaultColumn`
3. If `order` is `'asc'` or `'desc'`, uses it; otherwise falls back to `defaultDirection`
4. Always returns a valid sort — never throws

---

## 📂 Codebase References

- **Pagination**: `app/utils/pagination.ts` — `paginate()` implementation
- **Sort params**: `app/utils/sort-params.ts` — `parseSort()` implementation
- **Usage**: `app/actions/client/controller.tsx` — Both utilities used in `index()` and `grid()`

## Related

- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — How these are used in the grid
- [Pagination/Sorting/Filtering (remix3)](../../../development/remix3/lookup/pagination-sorting-filtering.md) — General patterns
