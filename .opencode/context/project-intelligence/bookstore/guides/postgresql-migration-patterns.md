<!-- Context: project-intelligence/bookstore/guides | Priority: high | Version: 1.0 | Updated: 2026-05-08 -->

# PostgreSQL Migration Patterns

**Purpose**: Key patterns and lessons learned from migrating the bookstore from SQLite to PostgreSQL.

## Prerequisites

- PostgreSQL running locally (`postgresql://postgres:postgres@localhost:5432/bookstorenew`)
- `pg` and `remix/data-table-postgres` packages installed
- `remix/data-table` adapter configured for PostgreSQL

## Migration Steps

### 1. Swap Data Adapter

```typescript
// Before: SQLite
// import { createDatabaseAdapter } from 'remix/data-table-sqlite'
// After: PostgreSQL
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

const adapter = createPostgresDatabaseAdapter(pool)
```

### 2. Replace Table Creation

SQLite `db.exec()` with migration files → raw `pool.query()` with `CREATE TABLE IF NOT EXISTS`.

### 3. Add afterRead/beforeWrite Hooks

Every DECIMAL and BIGINT column needs conversion hooks in the schema:

| Column Type | SQL Type | Hook Needed | Direction |
|-------------|----------|-------------|-----------|
| `price` | `DECIMAL(10,2)` | `afterRead` + `beforeWrite` | `Number()` |
| `total` | `DECIMAL(10,2)` | `afterRead` + `beforeWrite` | `Number()` |
| `unit_price` | `DECIMAL(10,2)` | `afterRead` + `beforeWrite` | `Number()` |
| `created_at` | `BIGINT` | `afterRead` | `parseInt(v, 10)` |
| `expires_at` | `BIGINT` | `afterRead` | `parseInt(v, 10)` |

### 4. Fix Boolean Fields in Controllers

PostgreSQL rejects `in_stock: "true"` (string). Use explicit conversion:

```typescript
// ✅ PostgreSQL-compatible
in_stock: inStock === 'true' || inStock === true
```

### 5. Update Tests

| SQLite Pattern | PostgreSQL Pattern |
|----------------|--------------------|
| `SELECT name FROM sqlite_master` | `db.adapter.hasTable({ name })` |
| Migration journal checks | Removed (no migrations) |
| Static test slugs | `slug: \`test-slug-${Date.now()}\`` |
| Static test emails | `email: \`user-${Date.now()}@example.com\`` |

### 6. Schema Column Type Notes

- Use `c.integer()` in TypeScript for BIGINT columns — `c.bigint()` returns `unknown`
- Use `c.decimal(precision, scale)` for DECIMAL columns
- The actual database types remain `BIGINT`/`DECIMAL` — hooks handle conversion

## Verification Checklist

- [ ] All DECIMAL columns have `afterRead` + `beforeWrite` hooks
- [ ] All BIGINT columns have `afterRead` hooks
- [ ] Boolean form fields converted explicitly (`=== 'true'`)
- [ ] Tests use `hasTable()`/`hasColumn()` instead of `sqlite_master`
- [ ] No migration journal checks in tests
- [ ] Test slugs/emails use `Date.now()` suffix for unique constraints
- [ ] Typecheck: 0 errors

## 📂 Codebase References

**Setup**:
- `bookstore/app/data/setup.ts` — Raw SQL table creation, seeding
- `bookstore/app/data/schema.ts` — Schema with type conversion hooks
- `bookstore/app/actions/admin/books/controller.tsx` — Boolean conversion fix
- `bookstore/app/data/setup.test.ts` — PostgreSQL test patterns (`hasTable`, `hasColumn`)

## Related

- `concepts/postgresql-compatibility.md` — Type handling details
- `concepts/raw-sql-table-creation.md` — Raw SQL pattern
- `errors/postgresql-gotchas.md` — Common issues
- `development/remix3/data/guides/postgresql-database.md` — General PostgreSQL setup
