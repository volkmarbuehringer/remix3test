<!-- Context: development/remix3/guides/postgresql-migration | Priority: medium | Version: 1.3 | Updated: 2026-04-23 -->

# PostgreSQL Migration Patterns

Key patterns learned from bookstore SQLite → PostgreSQL migration.

## Migration File: SERIAL for Auto-Increment

```sql
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  ...
)
```

**Don't use** `autoIncrement()` — use raw SQL with `SERIAL`.

## Schema Hooks: Per-Table Conversions

PostgreSQL returns DECIMAL/BIGINT as strings. Use `afterRead` hooks:

```typescript
// books - DECIMAL price → number
books.afterRead = ({ value }) => {
  if (typeof value.price === 'string') value.price = parseFloat(value.price)
  return { value }
}

// users - BIGINT created_at → number
users.afterRead = ({ value }) => {
  if (typeof value.created_at === 'string') value.created_at = parseInt(value.created_at, 10)
  return { value }
}

// orders - BIGINT created_at + DECIMAL total
orders.afterRead = ({ value }) => {
  if (typeof value.created_at === 'string') value.created_at = parseInt(value.created_at, 10)
  if (typeof value.total === 'string') value.total = parseFloat(value.total)
  return { value }
}

// order_items - DECIMAL unit_price
orderItems.afterRead = ({ value }) => {
  if (typeof value.unit_price === 'string') value.unit_price = parseFloat(value.unit_price)
  return { value }
}

// passwordResetTokens - BIGINT user_id + expires_at
passwordResetTokens.afterRead = ({ value }) => {
  if (typeof value.user_id === 'string') value.user_id = parseInt(value.user_id, 10)
  if (typeof value.expires_at === 'string') value.expires_at = parseInt(value.expires_at, 10)
  return { value }
}
```

## Seed Data: Fetch IDs Before Reference

Cannot use hardcoded IDs — PostgreSQL auto-generates them:

```typescript
// WRONG - ID unknown
await db.create(orderItems, { order_id: 1, book_id: 1, quantity: 1 })

// CORRECT - fetch first, then reference
let orders = await db.findAll(orders)
let books = await db.findAll(books)
await db.create(orderItems, {
  order_id: orders[0].id,
  book_id: books[0].id,
  quantity: 1,
})
```

## db.count(): Wrap with Number()

PostgreSQL `COUNT(*)` returns BIGINT (string):

```typescript
let count = Number(await db.count(books))
if (count === 0) { /* empty */ }
```

## Quick Reference

| Pattern | Solution |
| ------- | -------- |
| Auto-increment | `SERIAL` in raw SQL |
| DECIMAL fields | `parseFloat()` in afterRead |
| BIGINT fields | `parseInt(str, 10)` in afterRead |
| db.count() | `Number()` wrapper |
| Seed FK references | Fetch target records first |

## More Info

- Setup & config: earlier section in this file
- Boolean types: `is_admin === 't'` → `true`
- Connection: `postgresql://user:pass@host:port/db`

## Codebase Reference

- Schema: `bookstore/app/data/schema.ts`
- Migrations: `bookstore/db/migrations/`