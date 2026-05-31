<!-- Context: project-intelligence/bookstore/lookup | Priority: high | Version: 1.0 | Updated: 2026-05-08 -->

# PostgreSQL Database Reference

**Purpose**: Quick reference for database configuration, schema, and seed data.

## Connection

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/bookstorenew` |
| Port | 44100 (app server) |

## Tables

| Table | Primary Key | Key Columns |
|-------|-------------|-------------|
| `books` | `id SERIAL` | `slug TEXT UNIQUE`, `price DECIMAL(10,2)`, `in_stock BOOLEAN` |
| `users` | `id SERIAL` | `email TEXT UNIQUE`, `password_hash TEXT`, `role TEXT`, `created_at BIGINT` |
| `orders` | `id SERIAL` | `user_id INTEGER FK`, `total DECIMAL(10,2)`, `status TEXT`, `created_at BIGINT` |
| `order_items` | `(order_id, book_id)` | `order_id INTEGER FK`, `book_id INTEGER FK`, `unit_price DECIMAL(10,2)`, `quantity INTEGER` |
| `password_reset_tokens` | `token TEXT` | `user_id INTEGER FK`, `expires_at BIGINT` |

## Seed Data

| Entity | Count | Details |
|--------|-------|---------|
| Books | 100 | 5 genres rotating, 10 authors (10 books each), slugs `book-1` → `book-100` |
| Users | 2 | admin + customer |
| Orders | 2 | 1 delivered, 1 shipped |
| Order items | 3 | distributed across orders |

### Genres (rotate, 5-cycle)

`Fiction`, `Non-Fiction`, `Sci-Fi`, `Mystery`, `Biography`

### Users

| Email | Password | Role |
|-------|----------|------|
| admin@bookstore.com | admin123 | admin |
| customer@example.com | password123 | customer |

## Key Files

| File | Purpose |
|------|---------|
| `app/data/setup.ts` | Pool, adapter, table creation, seed |
| `app/data/schema.ts` | Table schemas, afterRead/beforeWrite hooks |
| `app/middleware/database.ts` | Injects `Database` into request context |

## Related Commands

```bash
pnpm start                     # Server on port 44100
pnpm test                      # ~62 tests
pnpm run typecheck             # TypeScript validation (tsgo --noEmit)
```

## 📂 Codebase References

- `bookstore/app/data/setup.ts` — Full database setup
- `bookstore/app/data/schema.ts` — Schema definitions
- `bookstore/app/middleware/database.ts` — Context injection

## Related

- `concepts/postgresql-compatibility.md` — Type patterns
- `concepts/raw-sql-table-creation.md` — Table creation pattern
- `lookup/quick-reference.md` — General app reference
