<!-- Context: project-intelligence/bookstore/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-08 -->

# PostgreSQL Type Compatibility

**Purpose**: Type-level patterns needed when using `remix/data-table` with PostgreSQL (DECIMAL, BIGINT, BOOLEAN handling).

## Core Idea

PostgreSQL returns DECIMAL and BIGINT columns as **strings** to the JavaScript driver. Without conversion hooks, schema column types must use `c.integer()` instead of `c.bigint()` for proper TypeScript inference. `afterRead`/`beforeWrite` hooks bridge the type gap.

## Key Points

- **BIGINT columns**: PostgreSQL returns as string → `afterRead` with `parseInt(value, 10)`. TS schema uses `c.integer()` to avoid `unknown` type.
- **DECIMAL columns**: PostgreSQL returns as string → `afterRead` with `Number()` + `beforeWrite` with `Number()`. String form data also needs the `beforeWrite` conversion.
- **BOOLEAN columns**: PostgreSQL enforces strict boolean — no truthy/falsy coercion. Form values (`'true'` string) must be explicitly converted.
- **SERIAL primary keys**: Auto-incrementing integers — work identically to SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`.

## Hook Pattern

```typescript
afterRead({ value }) {
  let next = { ...value }
  if (typeof next.price === 'string') next.price = Number(next.price)
  if (typeof next.created_at === 'string') next.created_at = parseInt(next.created_at, 10)
  return { value: next }
},
beforeWrite({ value }) {
  let next = { ...value }
  if (typeof next.price === 'string') next.price = Number(next.price)
  if (typeof next.in_stock === 'string') next.in_stock = next.in_stock === 'true'
  return { value: next }
},
```

## Reference

`remix/data-table` docs for `afterRead`/`beforeWrite`, `c.decimal()`, `c.bigint()`, `c.integer()`, `c.boolean()`.

## 📂 Codebase References

**Implementation**:
- `bookstore/app/data/schema.ts` — All table schemas with conversion hooks

## Related

- `concepts/raw-sql-table-creation.md` — Raw SQL CREATE TABLE pattern
- `guides/postgresql-migration-patterns.md` — Migration step-by-step
- `errors/postgresql-gotchas.md` — Common PostgreSQL issues
- `development/remix3/data/guides/data-table-postgres-setup.md` — Adapter setup
