<!-- Context: project-intelligence/bookstore/guides | Priority: high | Version: 2.0 | Updated: 2026-05-08 -->

# Testing Guide

## Test Stats

| Suite | Count | Status |
|-------|-------|--------|
| Unit/Integration | ~60 | ✅ All pass |
| E2E (Playwright) | 2 | ❌ 2 browser timeouts (flaky) |

## Seed Data

| Email | Password | Role |
|-------|----------|------|
| admin@bookstore.com | admin123 | admin |
| customer@example.com | password123 | customer |

Books: 100 seeded

## PostgreSQL Test Patterns

### Schema Verification (instead of sqlite_master)
```typescript
// ✅ PostgreSQL
assert.equal(await db.adapter.hasTable({ name: 'books' }), true)
assert.equal(await db.adapter.hasColumn({ name: 'books' }, 'slug'), true)
```

### Unique Test Data (avoid re-run collisions)
```typescript
let slug = `test-book-${Date.now()}`
let email = `newuser-${Date.now()}@example.com`
```

### Database Cleanup (prevent test hanging)
```typescript
import { closeBookstoreDatabase } from './data/setup.ts'
after(async () => { await closeBookstoreDatabase() })
```

## Common Issues

### Unit Tests Hanging
Close the pool in `after` hook (see above).

### Unique Constraint on Re-run
Use `Date.now()` suffix for slugs and emails.

## Test Commands

```bash
pnpm test                    # All unit/integration tests
pnpm run typecheck           # TypeScript validation
pnpm run lint                # Lint
```

## Test Files

| File | Purpose |
|------|---------|
| `app/data/setup.test.ts` | Schema creation, idempotency, password hashes |
| `app/actions/controller.test.ts` | Root routes, asset serving |
| `app/actions/books/controller.test.ts` | Book list, search |
| `app/actions/auth/controller.test.ts` | Login, register, logout |
| `app/actions/cart/controller.test.ts` | Cart add/remove/clear |
| `app/actions/checkout/controller.test.ts` | Checkout flow |
| `app/actions/admin/controller.test.ts` | Admin auth guard |
| `app/actions/admin/books/controller.test.ts` | Admin CRUD |
| `app/app.test.e2e.ts` | Playwright browser tests |

## 📂 Codebase References

**Tests**:
- `bookstore/app/data/setup.test.ts` — PostgreSQL schema verification
- `bookstore/app/actions/controller.test.ts` — Dynamic slug pattern

## Related

- `guides/postgresql-migration-patterns.md` — Test migration steps
- `lookup/postgresql-database-reference.md` — Seed data details
- `errors/postgresql-gotchas.md` — Unique constraint errors
