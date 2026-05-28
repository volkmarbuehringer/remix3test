<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Data Table

**Purpose**: Typed relational query toolkit. One API across PostgreSQL, MySQL, and SQLite with typed queries, relations, and migrations.

**Key Points**:
- One API across databases (Postgres, MySQL, SQLite) — switch adapters without changing query code
- Query builder chain: `.select()`, `.where()`, `.join()`/`.leftJoin()`, `.with()` (eager loading), `.orderBy()`, `.limit()`, `.offset()`, `.groupBy()`, `.having()`, `.first()`, `.all()`, `.count()`, `.insert()`, `.update()`, `.delete()`, `.upsert()`
- CRUD helpers: `find` → `row|null`, `findOne` → `row|null`, `findMany` → `rows[]`, `create` → `WriteResult|row`, `createMany` → `WriteResult|rows[]`, `update` → `row` (throws if missing), `updateMany` → `WriteResult`, `delete` → `boolean`, `deleteMany` → `WriteResult`
- Lifecycle hooks: `validate()`, `beforeWrite()`, `beforeDelete()`, `afterRead()`, `afterWrite()`, `afterDelete()` — synchronous, return `{ value }` or `{ issues }`
- `fail(message, path)` / `fail(issues)` shortcut for returning validation issues from hooks
- Raw SQL: `sql\`...\`` tagged template, `rawSql(text, values)` — full escape hatch
- Predicate helpers: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `inList`, `notInList`, `like`, `ilike`, `between`, `isNull`, `notNull`, `and`, `or`
- Relations: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough` — eager-loaded via `.with()`
- `db.transaction(callback)` with nested savepoints, auto-commit/rollback
- Migration system: `createMigrationRunner`, `createMigrationRegistry`, `loadMigrations(dir)` — cross-ref guide

**Minimal Example**:
```ts
import { createDatabase, table, column as c, query, sql } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let users = table({
  name: 'users',
  columns: { id: c.uuid(), email: c.varchar(255), role: c.enum(['admin', 'customer']) },
  validate: ({ value }) => value.email ? { value } : { issues: [{ message: 'email required' }] },
})

let db = createDatabase(createPostgresDatabaseAdapter(pool))

// Query builder
let admins = await db.query(users).where({ role: 'admin' }).orderBy('email', 'asc').all()

// CRUD helpers
let user = await db.find(users, 'u_001')
let created = await db.create(users, { id: 'u_002', email: 'a@b.com' }, { returnRow: true })
let updated = await db.update(users, 'u_002', { role: 'admin' })

// Raw SQL
let rows = await db.exec(sql`select * from users where role = ${'admin'}`)
```

**Query Builder Chain** (via `db.query(table)` or standalone `query(table)`):

| Method | Description | Terminal? |
|--------|-------------|-----------|
| `.select(...cols)` / `.select({ alias: col })` | Project columns with optional aliases | No |
| `.distinct()` | Append DISTINCT modifier | No |
| `.where({ field: val })` / `.where(predicate)` | Filter rows (AND semantics) | No |
| `.join(table, on, type?)` / `.leftJoin(table, on)` | Inner/left join | No |
| `.with({ relation })` | Eager-load relations | No |
| `.orderBy(col, dir?)` | Sort (asc/desc) | No |
| `.limit(n)` / `.offset(n)` | Paginate | No |
| `.groupBy(...cols)` | Aggregate grouping | No |
| `.having(input)` | Post-aggregate filter | No |
| `.all()` | Return all matching rows | Yes |
| `.first()` | Return first row or null | Yes |
| `.find(pk)` | Find by primary key | Yes |
| `.count()` | Return count | Yes |
| `.insert(values)` | Insert row | Yes |
| `.update(changes)` | Update matching rows | Yes |
| `.delete()` | Delete matching rows | Yes |

**CRUD Helpers** (on `Database`):

| Helper | Input | Returns |
|--------|-------|---------|
| `find(table, pk, opts?)` | primary key | `row \| null` |
| `findOne(table, { where, orderBy?, with? })` | filter | `row \| null` |
| `findMany(table, { where?, orderBy?, limit?, offset?, with? })` | filter | `rows[]` |
| `create(table, values, opts?)` | partial row | `WriteResult` or `row` (with `returnRow: true`) |
| `createMany(table, values[], opts?)` | batch values | `WriteResult` or `rows[]` (with `returnRows: true`) |
| `update(table, pk, changes, opts?)` | pk + changes | `row` (throws if missing) |
| `updateMany(table, changes, { where, orderBy?, limit? })` | filter + changes | `WriteResult` |
| `delete(table, pk)` | primary key | `boolean` |
| `deleteMany(table, { where, orderBy?, limit? })` | filter | `WriteResult` |
| `count(table, { where? })` | filter | `number` |

**Lifecycle Hooks** (defined on `table(...)`):
- `validate(context)` / `beforeWrite(context)` — return `{ value }` or `{ issues }`; chain: beforeWrite → validate
- `beforeDelete(context)` — return `void` or `{ issues }` to abort
- `afterRead(context)` — return `{ value }` or `{ issues }`; transforms output rows
- `afterWrite(context)` / `afterDelete(context)` — side-effects only (return void)

**Raw SQL**: `sql\`select * from users where id = ${id}\`` → `{ text, values }`, or `rawSql(text, values)` for dynamic SQL. Pass to `db.exec()`.

**Transactions**: `db.transaction(async (tx) => { /* tx is a Database bound to the transaction */ })`. Nested transactions use savepoints.

**Adapter Capabilities**:

| Adapter | returning | savepoints | upsert | transactionalDdl |
|---------|-----------|------------|--------|------------------|
| postgres | ✅ | ✅ | ✅ | ✅ |
| mysql | ❌ | ✅ | ✅ | ✅ |
| sqlite | ✅ | ✅ | ✅ | ✅ |

**Migrations**: `createMigrationRunner(adapter, migrations)` with `.up({ to?, step?, dryRun? })` / `.down({ to?, step?, dryRun? })`. Full guide → `guides/data-table-migrations.md`.

**Reference**: `/home/lucky/remix/packages/data-table/src/`
