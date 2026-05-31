<!-- Context: development/remix3/packages/data | Priority: critical | Version: 1.1 | Updated: 2026-05-20 -->

# data-table

Typed relational query toolkit — one API across PostgreSQL, MySQL, and SQLite.

## Core Idea

Define tables once, build reusable queries with `query()`, execute via `db.exec()` or `db.query()`. Optional runtime validation via table-level `validate()`.

## Key Points

- **One API**: Same query CRUD + relations across Postgres, MySQL, SQLite
- **Query builder**: `.select()`, `.where()`, `.join()`/`.leftJoin()`, `.with()`, `.orderBy()`, `.groupBy()`, `.having()`, `.limit()`, `.offset()`, `.all()`, `.first()`, `.count()`
- **CRUD helpers**: `find`, `findOne`, `findMany`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`
- **Relations**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough` — eager `.with()`
- **Hooks**: `validate`, `beforeWrite`, `beforeDelete`, `afterRead`, `afterWrite`, `afterDelete`
- **Migrations**: built-in runner with dry-run, transaction modes, filesystem loading
- **Raw SQL**: `sql\`...\`` + `rawSql()` escape hatch

## Quick Example

```ts
import { query, table, column as c, createDatabase, sql, eq } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let users = table({
  name: 'users',
  columns: { id: c.uuid(), email: c.varchar(255), role: c.enum(['admin', 'customer']) },
  timestamps: true,
})

let orders = table({
  name: 'orders',
  columns: { id: c.uuid(), user_id: c.uuid(), total: c.decimal(10, 2), status: c.varchar(20) },
})

let db = createDatabase(createPostgresDatabaseAdapter(pool))

// Query builder with join
let results = await db.query(orders)
  .join(users, eq(orders.user_id, users.id))
  .where({ status: 'pending' })
  .orderBy('createdAt', 'desc')
  .limit(10)
  .all()
```

## Column Types

`uuid`, `varchar(len)`, `integer`, `bigint`, `decimal(p,s)`, `boolean`, `timestamp`, `text`, `json`, `jsonb`, `enum`, `date`, `binary`

## CRUD Return Behavior

| Helper | Return type | Notes |
|--------|-------------|-------|
| `find` | `row \| null` | Returns null when not found |
| `findOne` | `row \| null` | Adds LIMIT 1 |
| `create` (default) | `WriteResult` | `{ affectedRows, insertId? }` |
| `create({ returnRow: true })` | `row` | Requires returning support |
| `createMany` (default) | `WriteResult` | Bulk insert |
| `createMany({ returnRows: true })` | `rows[]` | Requires returning support |
| `update` | `row` | **Throws** if row not found |
| `updateMany` | `WriteResult` | |
| `delete` | `boolean` | true if any row affected |
| `deleteMany` | `WriteResult` | `{ affectedRows }` |
| `count` | `number` | |

## Lifecycle Hooks

All return `{ value }` or `{ issues }` (use `fail(message, path?)` for issues):
- `validate({ operation, tableName, value })` / `beforeWrite(...)` → `{ value }` or `{ issues }`
- `beforeDelete({ tableName, where, orderBy, limit, offset })` → `void` or `{ issues }`
- `afterRead({ tableName, value })` → `{ value }` or `{ issues }`
- `afterWrite({ operation, tableName, values, affectedRows, insertId? })` → `void`
- `afterDelete({ tableName, where, orderBy, limit, offset, affectedRows })` → `void`

## Predicates

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `inList`, `notInList`, `like`, `ilike`, `between`, `isNull`, `notNull`, `and`, `or`

## Raw SQL & Transactions

`db.exec(sql\`...\`)` / `db.exec(rawSql(text, values))` — `db.transaction(async (tx) => { ... })` (nested via savepoints).

## Adapters

| Package | returning | savepoints | upsert | transactionalDdl |
|---------|-----------|------------|--------|------------------|
| `remix/data-table-postgres` | ✅ | ✅ | ✅ | ✅ |
| `remix/data-table-mysql` | ❌ | ✅ | ✅ | ✅ |
| `remix/data-table-sqlite` | ✅ | ✅ | ✅ | ✅ |

## Reference

`/home/lucky/remix/packages/data-table/src/`
