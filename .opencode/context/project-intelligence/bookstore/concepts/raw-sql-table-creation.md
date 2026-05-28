<!-- Context: project-intelligence/bookstore/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-08 -->

# Raw SQL Table Creation

**Purpose**: PostgreSQL table creation pattern using raw SQL (`pool.query()`) instead of migration files.

## Core Idea

Tables are created inline in `setup.ts` using `CREATE TABLE IF NOT EXISTS` with raw SQL strings passed to `pool.query()`. No migration framework, no `db/migrations/` directory. The `initialize()` function is called once (idempotent via promise caching).

## Pattern

```typescript
// app/data/setup.ts
async function initialize(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      in_stock BOOLEAN NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS books_slug_idx ON books(slug)`)
}
```

## Key Points

- **`CREATE TABLE IF NOT EXISTS`** — Idempotent, safe to call on every server start
- **`SERIAL PRIMARY KEY`** — PostgreSQL auto-increment (maps to `c.integer()` in schema)
- **Explicit types** — `DECIMAL(10,2)`, `BOOLEAN`, `BIGINT`, `TEXT` — no implicit choices
- **Indexes** created separately with `CREATE INDEX IF NOT EXISTS`
- **Foreign keys** use `REFERENCES` with `ON DELETE RESTRICT` / `CASCADE`
- **Promise caching** (`initializePromise`) prevents duplicate table creation on concurrent access

## When to Use

- Development/demo apps where migration version tracking is unnecessary
- Following the `my_app` reference pattern (no migrations, raw SQL)

## 📂 Codebase References

**Implementation**:
- `bookstore/app/data/setup.ts` — Raw SQL table creation + seeding
- `my_app/app/data/setup.ts` — Reference implementation (same pattern)

## Related

- `concepts/postgresql-compatibility.md` — Type handling for PostgreSQL
- `guides/postgresql-migration-patterns.md` — Migration guide
- `lookup/postgresql-database-reference.md` — Table schemas, seed data
