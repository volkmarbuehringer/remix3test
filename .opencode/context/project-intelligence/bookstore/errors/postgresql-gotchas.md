<!-- Context: project-intelligence/bookstore/errors | Priority: high | Version: 1.0 | Updated: 2026-05-08 -->

# PostgreSQL Gotchas

**Purpose**: Common PostgreSQL-specific issues when using `remix/data-table`.

## Error: Boolean Coercion Failure

**Symptom**: `error: column "in_stock" is of type boolean but expression is of type text` on form submit.

**Cause**: Form data sends boolean fields as strings (`'true'` / `'false'`). PostgreSQL BOOLEAN rejects string input.

**Solution** — Explicit boolean conversion:
```typescript
// ❌ Wrong — PostgreSQL rejects string
in_stock: inStock
// ✅ Correct — explicit boolean
in_stock: inStock === 'true' || inStock === true
```

**Prevention**: Always use `=== 'true'` pattern for boolean fields sourced from form data. Handle in controller, not schema.

## Error: DECIMAL Returned as String

**Symptom**: `price` field is `"19.99"` (string) instead of `19.99` (number). Operations like `price * 2` produce NaN.

**Cause**: PostgreSQL driver returns `DECIMAL`/`NUMERIC` columns as JavaScript strings.

**Solution** — `afterRead` + `beforeWrite` hooks:
```typescript
afterRead({ value }) {
  if (typeof value.price === 'string') value.price = Number(value.price)
  return { value }
}
```

Prevention checklist in `guides/postgresql-migration-patterns.md`.

## Error: BIGINT Returned as String

**Symptom**: `created_at` is `"1744000000000"` (string) instead of `1744000000000` (number).

**Cause**: Same as DECIMAL — PostgreSQL driver returns BIGINT as string.

**Solution** — `afterRead` with `parseInt`:
```typescript
afterRead({ value }) {
  if (typeof value.created_at === 'string') {
    value.created_at = parseInt(value.created_at, 10)
  }
  return { value }
}
```

## Error: Unique Constraint Violation on Test Re-run

**Symptom**: `error: duplicate key value violates unique constraint "books_slug_key"` on second test run.

**Cause**: Static test slug values collide with existing rows from previous run (data not cleaned up between test runs).

**Solution** — Dynamic unique values:
```typescript
let slug = `test-book-${Date.now()}`
let email = `user-${Date.now()}@example.com`
```

## Error: TypeScript `c.bigint()` Returns `unknown`

**Symptom**: `Property 'created_at' does not exist on type 'unknown'`.

**Cause**: `remix/data-table` `c.bigint()` returns `unknown` type — cannot use for type inference.

**Solution**: Use `c.integer()` in TypeScript schema even for `BIGINT` columns:
```typescript
// Database: created_at BIGINT NOT NULL
// Schema:  c.integer() through TS (BIGINT → string → parseInt → number fits in integer range)
created_at: c.integer(),
```

## 📂 Codebase References

**Implementation**:
- `bookstore/app/data/schema.ts` — All conversion hooks
- `bookstore/app/actions/admin/books/controller.tsx:90` — Boolean conversion
- `bookstore/app/actions/controller.test.ts:31` — Dynamic slug pattern
- `bookstore/app/actions/auth/controller.test.ts:108` — Dynamic email pattern

## Related

- `concepts/postgresql-compatibility.md` — Type patterns
- `guides/postgresql-migration-patterns.md` — Migration checklist
- `guides/database-config.md` — Database setup
