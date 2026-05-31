<!-- Context: project-intelligence/bookstore/guides | Priority: high | Version: 1.1 | Updated: 2026-05-08 -->

# Database Configuration

## Setup

```bash
# Database initializes on first server start (auto-creates tables + seeds)
pnpm start

# Or run tests (also auto-initializes)
pnpm test
```

## Architecture

- **ORM**: `remix/data-table` with `remix/data-table-postgres` adapter
- **Table Creation**: Raw SQL `CREATE TABLE IF NOT EXISTS` in `setup.ts` — no migrations
- **Seeding**: `initialize()` creates 100 books + 2 users + 2 orders (conditional on empty tables)
- **Connection**: `pg.Pool` via `DATABASE_URL` env var
- **Pool Cleanup**: `closeBookstoreDatabase()` on process exit (test mode)

## Key Files

| File | Purpose |
|------|---------|
| `app/data/setup.ts` | Pool, adapter, raw SQL table creation, seed data |
| `app/data/schema.ts` | Table definitions with PostgreSQL conversion hooks |
| `app/middleware/database.ts` | Injects `Database` into request context |

## Getting the Database

```typescript
import { Database } from 'remix/data-table'

// In a route handler:
async action({ get }) {
  let db = get(Database)
  let books = await db.findMany(booksTable, { where: { in_stock: true } })
}
```

## Type Conversion Notes

PostgreSQL returns DECIMAL and BIGINT as strings. Schema hooks handle conversion:

| Column | DB Type | TS Schema | Hook |
|--------|---------|-----------|------|
| `price`, `total`, `unit_price` | `DECIMAL(10,2)` | `c.decimal(10,2)` | `afterRead` + `beforeWrite`: `Number()` |
| `created_at`, `expires_at` | `BIGINT` | `c.integer()` | `afterRead`: `parseInt(v, 10)` |

## 📂 Codebase References

- `bookstore/app/data/setup.ts` — Complete setup with raw SQL
- `bookstore/app/data/schema.ts` — Schema + hooks

## Related

- `guides/postgresql-migration-patterns.md` — Migration steps and patterns
- `concepts/postgresql-compatibility.md` — Type handling
- `concepts/raw-sql-table-creation.md` — Raw SQL pattern details
