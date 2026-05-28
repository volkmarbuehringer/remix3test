<!-- Context: development/remix3/guides/data-table-queries | Priority: medium | Version: 1.1 | Updated: 2026-04-06 -->

# Guide: data-table Query Objects

**Purpose**: Build reusable, composable query objects for complex database operations

---

## Core Concept

Use `query(table)` to create standalone reusable Query objects that can be composed, stored, and executed against any database. Use `db.query(table)` for the same chainable API bound to a database instance.

---

## Key Points

- `query(table)` - Creates unbound Query (reusable, composable)
- `db.query(table)` - Creates bound Query (shorthand)
- Chain methods: `.where()`, `.join()`, `.select()`, `.orderBy()`, `.limit()`, `.with()` (relations)
- Execute with `db.exec(query)` for standalone queries
- Use bound methods `.all()`, `.first()` for immediate execution
- Supports relations: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`

---

## Minimal Example

```ts
import { eq, ilike, query } from 'remix/data-table'

// Standalone query (lazy until exec)
let pendingOrders = query(orders)
  .join(users, eq(orders.user_id, users.id))
  .where({ status: 'pending' })
  .select({ orderId: orders.id, email: users.email })
  .orderBy(orders.created_at, 'desc')
  .limit(20)

let results = await db.exec(pendingOrders)

// Bound shorthand (immediate)
let recent = await db.query(orders)
  .where({ status: 'pending' })
  .orderBy('created_at', 'desc')
  .all()
```

---

## Query Methods

| Method | Description |
|--------|-------------|
| `.where(predicate)` | Filter rows |
| `.where(rawPredicate)` | Complex where clause |
| `.join(table, on)` | Inner join |
| `.leftJoin(table, on)` | Left join |
| `.select({ alias: table.col })` | Project columns |
| `.orderBy(column, direction)` | Sort results |
| `.limit(n)` | Limit results |
| `.offset(n)` | Offset results |
| `.with({ relation })` | Eager load relations |
| `.first()` | Get first row |
| `.all()` | Get all rows |

---

## Relation Eager Loading

```ts
import { hasMany } from 'remix/data-table'

let userOrders = hasMany(users, orders)

let customers = await db.exec(
  query(users)
    .where({ role: 'customer' })
    .with({
      recentOrders: userOrders
        .where({ status: 'shipped' })
        .orderBy('created_at', 'desc')
        .limit(3),
    })
)
// customers[0].recentOrders is fully typed
```

---

## Performance Optimization

Use `db.count()` instead of querying all rows:

```typescript
// ❌ WRONG - Loads all rows into memory
let total = (await db.query(books).select().all()).length

// ✅ CORRECT - Database counts efficiently
let total = await db.count(books)

// With filter
let total = await db.count(books, { where: ilike('genre', genre) })
```

## Database-Specific Tips

**PostgreSQL `ilike`** is case-insensitive (no need for `.toLowerCase()`):

```typescript
// ✅ Correct - ilike handles case
.where(ilike('genre', 'Fiction'))  // Matches 'fiction', 'FICTION', etc.

// ❌ Unnecessary
.where(ilike('genre', genre.toLowerCase()))
```

**Remove debug delays** from production code:

```typescript
// ❌ Remove before production
await new Promise(r => setTimeout(r, 500))  // Artificial delay

// ✅ Production-ready
let results = await db.query(books).all()
```

## Reference

- Full docs: https://github.com/remix-run/remix/tree/main/packages/data-table
- Related: `guides/data-table-crud.md`, `guides/data-table-schema.md`

## 📂 Codebase References

**Implementation**:
- `bookstore/app/controllers/books/controller.tsx` - Count queries with pagination
- `bookstore/app/controllers/cart/api/controller.tsx` - Database lookups with validation
