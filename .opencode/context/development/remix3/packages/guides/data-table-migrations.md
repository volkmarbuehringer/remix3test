<!-- Context: development/remix3/packages/guides | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Data Table Migrations

**Purpose**: Manage schema changes with the built-in data-table migration system. Supports dry-run planning, transaction modes, and filesystem or programmatic migration loading.

## Directory Convention

Each migration is a directory named `YYYYMMDDHHmmss_<name>` containing:
- `up.sql` — required, forward SQL
- `down.sql` — optional, revert SQL (omit for irreversible migrations)

```
app/db/migrations/
  20260401000001_create_users/
    up.sql
    down.sql
  20260402000002_add_orders/
    up.sql
    down.sql
```

## Runner Setup

```ts
import { createMigrationRunner, loadMigrations } from 'remix/data-table/migrations'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let adapter = createSqliteDatabaseAdapter(new Database('app.db'))

// Load migrations from disk (Node.js only)
let migrations = await loadMigrations('./app/db/migrations')

let runner = createMigrationRunner(adapter, migrations, {
  journalTable: 'my_migrations',  // defaults to 'data_table_migrations'
})
```

## Runner Methods

- `runner.up({ to?, step?, dryRun? })` — Apply pending migrations
- `runner.down({ to?, step?, dryRun? })` — Revert applied migrations
- `runner.status()` — List all migrations with status: `applied` | `pending` | `drifted`

### `to` vs `step` (mutually exclusive)

`to` targets a migration id; `step` is a positive integer count. Omit both to run all.

### Dry Run

`dryRun: true` returns `{ applied, reverted, sql: string[] }` without executing. No journal is created.

## Transaction Modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Wrap in transaction when adapter supports transactional DDL |
| `required` | Wrap; throws if adapter lacks transactional DDL |
| `none` | Never wrap (for DDL that cannot run in a transaction) |

Set via `transaction` property on the migration descriptor or via a SQL directive:

```sql
-- data-table/transaction: none
CREATE INDEX CONCURRENTLY ...
```

## Driver Configuration Notes

- **pg (PostgreSQL)**: Works out of the box. Supports transactional DDL and migration lock.
- **mysql2 (MySQL)**: Requires `multipleStatements: true` in the pool config:
  ```ts
  let pool = createPool({ uri: DATABASE_URL, multipleStatements: true })
  ```
- **better-sqlite3 (SQLite)**: Works out of the box. Supports transactional DDL.

## Programmatic Registration

```ts
import { createMigrationRegistry } from 'remix/data-table/migrations'

let registry = createMigrationRegistry()
registry.register({
  id: '20260401000001',
  name: 'create_users',
  up: 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL)',
  down: 'DROP TABLE users',
})

let runner = createMigrationRunner(adapter, registry)
```

`createMigrationRegistry()` throws on duplicate `id`. Pass an initial array:
```ts
createMigrationRegistry([migration1, migration2])
```

## Filesystem Loading

```ts
import { loadMigrations } from 'remix/data-table/migrations/node'

let migrations = await loadMigrations('./app/db/migrations')
```

Scans subdirectories matching `YYYYMMDDHHmmss_<name>`, reads `up.sql` (required) and `down.sql` (optional). Returns sorted `MigrationDescriptor[]`. Throws on duplicate ids.

## Full Example CLI Script

```ts
// app/db/migrate.ts
import { Database } from 'better-sqlite3'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
import { createMigrationRunner, loadMigrations } from 'remix/data-table/migrations/node'

async function main() {
  let adapter = createSqliteDatabaseAdapter(new Database('app.db'))
  let migrations = await loadMigrations('./app/db/migrations')
  let runner = createMigrationRunner(adapter, migrations)
  let direction = process.argv[2] ?? 'up'
  let dryRun = process.argv.includes('--dry-run')
  if (direction === 'status') return console.table(await runner.status())
  let result = direction === 'up' ? await runner.up({ dryRun }) : await runner.down({ dryRun })
  if (dryRun) result.sql.forEach((s) => console.log(s + '\n;'))
  else console.log(`Applied: ${result.applied.length}, Reverted: ${result.reverted.length}`)
}
main().catch(console.error)
```

## Reference

- Runner: `/home/lucky/remix/packages/data-table/src/lib/migrations/runner.ts`
- Registry: `/home/lucky/remix/packages/data-table/src/lib/migrations/registry.ts`
- Node loader: `/home/lucky/remix/packages/data-table/src/lib/migrations-node.ts`
- Directive parser: `/home/lucky/remix/packages/data-table/src/lib/migrations/directive.ts`
- Journal store: `/home/lucky/remix/packages/data-table/src/lib/migrations/journal-store.ts`
- Types: `/home/lucky/remix/packages/data-table/src/lib/migrations.ts`
