<!-- Context: remix3/data-table-schema | Priority: medium | Version: 1.0 | Updated: 2026-04-01 -->

# Guide: data-table Table Schema & Hooks

**Purpose**: Define typed tables with column definitions and lifecycle hooks for validation and transformation

---

## Core Concept

Define tables with `table()` and column definitions, then add hooks (`validate`, `beforeWrite`, `afterRead`) for runtime validation, data transformation, and lifecycle callbacks. Hooks are optional but powerful for data integrity.

---

## Key Points

- `table({ name, columns, hooks? })` - Define table schema
- `column as c` - Column type builder (integer, text, uuid, enum, etc.)
- `validate({ operation, value })` - Validate/coerce write payloads
- `beforeWrite({ operation, value })` - Transform before write
- `afterRead({ value })` - Transform after read
- `fail(message, path)` - Return validation errors from hooks
- Operations: `'create'`, `'update'`, `'createMany'`, `'updateMany'`, `'delete'`

---

## Minimal Example

```ts
import { column as c, fail, table } from 'remix/data-table'

let users = table({
  name: 'users',
  columns: {
    id: c.uuid(),
    email: c.varchar(255),
    role: c.enum(['customer', 'admin']),
    created_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    // Normalize email
    if (typeof value.email === 'string') {
      return { value: { ...value, email: value.email.toLowerCase().trim() } }
    }
    return { value }
  },
  validate({ operation, value }) {
    if (operation === 'create' && !value.email) {
      return fail('Email required', ['email'])
    }
    return { value }
  },
  afterRead({ value }) {
    // Transform on read
    return { value }
  },
})
```

---

## Column Types

```ts
// Basic types
c.integer()
c.text()
c.varchar(255)
c.uuid()
c.boolean()
c.decimal(10, 2)  // Returns STRING, use Number(x).toFixed(2) for display
c.bigint()

// With constraints
c.integer().primaryKey()
c.varchar(255).notNull().unique()
c.enum(['pending', 'processing', 'done'])
c.timestamp({ withTimezone: true }).defaultNow()
```

### Important: Decimal Returns String

`c.decimal(10, 2)` returns a **string** from the database, not a number. Always convert for calculations or display:

```typescript
// ❌ Wrong - produces invalid formatting
<p>${order.total}</p>  // "99.9900" or similar

// ✅ Correct - convert to number, format with toFixed
<p>${Number(order.total).toFixed(2)}</p>  // "99.99"

// For calculations, also convert first
let total = orders.reduce((sum, o) => sum + Number(o.total), 0)
```

---

## Lifecycle Hooks Order

Write order: `beforeWrite → validate → timestamp/default → execute → afterWrite`

- `beforeWrite` - Transform input before validation
- `validate` - Check constraints, coerce types
- `beforeDelete` - Veto deletes by returning issues
- `afterRead` - Transform output, runs for each row

---

## Reference

- Full docs: https://github.com/remix-run/remix/tree/main/packages/data-table
- Related: `guides/data-table-crud.md`, `guides/data-table-queries.md`
