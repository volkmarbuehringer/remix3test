<!-- Context: project-intelligence/newapp/concepts/database-architecture | Priority: high | Version: 1.1 | Updated: 2026-05-24 -->

# Concept: Database Architecture

**Core Idea**: PostgreSQL database accessed through a typed `Database` abstraction (`remix/data-table` + `remix/data-table-postgres` adapter). Schema is defined declaratively with `table()` and connected as `context.db` via the `loadDatabase()` middleware.

---

## Layers

```
Database (remix/data-table)        → Typed CRUD (create, find, update, delete, count)
  ↕
PostgresAdapter (remix/data-table-postgres)  → SQL translation
  ↕
pg Pool                                  → Connection pooling
  ↕
PostgreSQL                                → Database server
```

## Setup

`app/data/setup.ts`:
```ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = createPostgresDatabaseAdapter(pool)
export const db = createDatabase(adapter)
```

`app/middleware/database.ts` installs it as `context.db`:
```ts
export function loadDatabase() {
  return async (context, next) => {
    context.set(Database, db, { property: 'db' })
    return next()
  }
}
```

## Schema Tables

| Table | Primary Key | Key Columns | Purpose |
|-------|-------------|-------------|---------|
| `users` | `id` (serial) | `email`, `password_hash`, `name`, `role` | Auth accounts |
| `messages` | `id` (serial) | `sender_id` (FK→users), `content`, `created_at` | Message board |
| `chatlog` | `id` (text) | `conversation` (JSONB), `created_at`, `updated_at` | AI chat history |
| `workflow_runs` | `id` (text) | `workflow_id`, `status`, `steps`, `result`, `error` | Workflow execution |
| `clients` | `id` (serial) | `name`, `email`, `role`, `status`, `registered` | CRUD demo data |
| `appointments` | `id` (serial) | `user_id` (FK), `title`, `date` (BIGINT), `during` (int4range), computed `start_min`/`end_min` | Calendar appointments with overlap prevention |
| `appointtypes` | `id` (serial) | `user_id` (FK), `title` | Appointment type templates for drag insertion |

## CRUD Patterns

```tsx
// Create
await db.create(users, { email, name, role: 'customer', created_at: Date.now() })
await db.createMany(messages, [{ sender_id: 1, content: 'Hi' }, ...])

// Read
let user = await db.findOne(users, { where: { email } })
let all = await db.find(users)       // all rows
let page = await db.find(users, {    // paginated
  where: { role: 'admin' },
  limit: 10, offset: 20,
  orderBy: { column: 'created_at', direction: 'desc' },
})

// Update
await db.update(users, { name: 'New Name' }, { id: userId })
await db.updateMany(messages, { content: 'edited' }, { sender_id: userId })

// Delete
await db.delete(messages, { id: messageId })

// Count
let count = await db.count(users)
let filtered = await db.count(users, { where: { role: 'admin' } })
```

## Schema Features

- **`beforeWrite`** — Sanitize/transform on create+update (`trim()`, `lowercase()`, defaults). Also converts `start_min`/`end_min` pair to `int4range` string and strips computed columns (see [PostgreSQL Range Types](.//postgres-range-types.md)).
- **`validate`** — Return validation issues (names required, email format, password required, time bounds 0–1440, start < end)
- **`afterRead`** — Post-processing (parse JSON strings, convert BIGINT strings to numbers, normalize `int4range` driver objects to strings)
- **Column types**: `c.integer()`, `c.text()`, `c.bigint()`, `c.enum()`, `c.json()` — plus `c.text()` as proxy for `int4range` (see [range types concept](postgres-range-types.md))

### ⚠️ Caveat: Raw SQL Bypasses `afterRead`

`context.db.*()` methods run `afterRead` automatically. **Raw `pool.query()` bypasses it entirely**. For `BIGINT` columns, the `pg` driver returns them as strings — `new Date(string)` produces `Invalid Date`. Always convert manually after raw queries (see [afterRead error](../errors/raw-sql-bypasses-afterread.md)).

## 📂 Codebase References

- **Database setup**: `app/data/setup.ts` — Pool, adapter, `createDatabase()`, seeding
- **Schema definitions**: `app/data/schema.ts` — 5 tables with lifecycle hooks
- **Middleware**: `app/middleware/database.ts` — `loadDatabase()` installs context.db
- **Raw queries**: `app/actions/admin-messages-controller.tsx` — `pool.query()` for joins
- **Controllers**: `app/actions/client/controller.tsx` — Full CRUD demo with pagination/sort

## Related

- [Middleware Chain](./middleware-chain.md) — loadDatabase in stack
- [Controller Pattern](../guides/controller-pattern.md) — CRUD in controller actions
- [Frame CRUD Pattern](../guides/frame-crud-pattern.md) — Grid-based CRUD with pagination
- [Client Lab Architecture](./client-lab-architecture.md) — Full CRUD implementation
- [PostgreSQL Range Types](./postgres-range-types.md) — `int4range` with `remix/data-table`
- [Computed Columns](./computed-columns.md) — GENERATED ALWAYS AS...STORED pattern
- [Exclusion Constraints](./exclusion-constraints.md) — Overlap prevention with `btree_gist`
- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer with range types
- [remix3 data docs](../../development/remix3/data/navigation.md) — General data-table patterns
