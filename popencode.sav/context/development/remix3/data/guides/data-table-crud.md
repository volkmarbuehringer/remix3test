<!-- Context: remix3/data-table-crud | Priority: medium | Version: 1.0 | Updated: 2026-04-01 -->

# Guide: data-table CRUD Helpers

**Purpose**: Common create/read/update/delete operations using data-table helpers

---

## Core Concept

data-table provides typed CRUD helpers (`find`, `create`, `update`, `delete`) for common database operations without building full query chains. All helpers are type-safe and support runtime validation.

---

## Key Points

- `db.find(table, id)` - Find single row by ID, returns row or null
- `db.findOne(table, { where, orderBy })` - Find first matching row
- `db.findMany(table, { where, orderBy, limit, offset })` - Find multiple rows
- `db.create(table, data)` - Insert row, returns WriteResult or row with `returnRow: true`
- `db.createMany(table, rows)` - Bulk insert
- `db.update(table, id, data)` - Update row by ID, returns updated row
- `db.updateMany(table, data, { where, orderBy, limit })` - Bulk update
- `db.delete(table, id)` - Delete row by ID, returns boolean
- `db.deleteMany(table, { where, orderBy, limit })` - Bulk delete
- All operations are type-safe based on table column definitions

---

## Minimal Example

```ts
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let db = createDatabase(createPostgresDatabaseAdapter(pool))

// Read
let user = await db.find(users, 'u_001')
let pending = await db.findOne(orders, { where: { status: 'pending' } })
let page = await db.findMany(orders, { where: { status: 'pending' }, limit: 20 })

// Write
let created = await db.create(users, { email: 'new@example.com', role: 'customer' })
let updated = await db.update(users, 'u_001', { role: 'admin' })
let deleted = await db.delete(users, 'u_001')
```

---

## Return Values

| Method | Default Return | With Options |
|--------|---------------|--------------|
| `find/findOne` | row or null | - |
| `findMany` | rows array | - |
| `create` | WriteResult | row with `returnRow: true` |
| `createMany` | WriteResult | rows with `returnRows: true` |
| `update` | updated row | throws if not found |
| `updateMany/deleteMany` | WriteResult | - |
| `delete` | boolean | - |

---

## Where Clause

```ts
// Simple equality
{ where: { status: 'pending' } }

// With OR
import { or }
{ where: or({ status: 'pending' }, { status: 'processing' }) }

// Order by
{ orderBy: ['created_at', 'desc'] }
{ orderBy: [['status', 'asc'], ['created_at', 'desc']] }
```

---

## Reference

- Full docs: https://github.com/remix-run/remix/tree/main/packages/data-table
- Related: `guides/data-table-queries.md`, `guides/data-table-schema.md`
