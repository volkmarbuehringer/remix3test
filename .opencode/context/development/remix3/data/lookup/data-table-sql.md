<!-- Context: remix3/data-table-sql | Priority: medium | Version: 1.0 | Updated: 2026-04-01 -->

# Lookup: data-table Raw SQL

**Purpose**: Quick reference for raw SQL escape hatch in data-table

---

## Core Concept

Use `sql` template tag for parameterized queries with safe value interpolation, or `rawSql` for unparameterized SQL when needed. Keeps queries safe from SQL injection.

---

## Key Points

- `sql` - Template tag for parameterized SQL (recommended)
- `rawSql` - Unparameterized SQL escape hatch
- Values interpolated with `${}` are parameterized per adapter dialect
- Avoid manual string concatenation - use `sql` template

---

## Quick Examples

```ts
import { rawSql, sql } from 'remix/data-table'

// Parameterized (safe)
let result = await db.exec(sql`
  select id, email
  from users
  where email = ${email}
    and created_at >= ${minCreatedAt}
`)

// Raw SQL (escape hatch)
await db.exec(rawSql('update users set role = ? where id = ?', ['admin', 'u_001']))
```

---

## Differences

| Method | Interpolation | Use Case |
|--------|--------------|----------|
| `sql` | `${value}` | Safe, parameterized queries |
| `rawSql` | `?` placeholders | Complex queries, dynamic SQL |

---

## Reference

- Full docs: https://github.com/remix-run/remix/tree/main/packages/data-table
- Related: `guides/data-table-crud.md`, `guides/data-table-queries.md`
