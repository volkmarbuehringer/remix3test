<!-- Context: project-intelligence/demo-bookstore | Priority: medium | Version: 1.3 | Updated: 2026-04-04 -->

# Bookstore Demo Patterns

> Reference to `bookstore/` - full-stack Remix 3 e-commerce demo.

## Quick Reference

- **Demo**: `bookstore/` - Full e-commerce with auth, cart, checkout, admin
- **Status**: Complete with tests (66 passing including e2e)
- **Patterns**: See `development/remix3/guides/demo-patterns.md`

## Key Info

| Layer     | Technology                        |
| --------- | --------------------------------- |
| Framework | Remix 3 (fetch-router)            |
| Database  | PostgreSQL (pg pool)              |
| Auth      | Session-based (httpOnly cookie)   |
| UI        | Web Components with mix()         |

## Database Seeding

The bookstore uses on-demand seeding (not automatic on startup):

```bash
# Run migrations only (no seed)
pnpm start

# Seed database and exit
pnpm run seed
```

**Seed data**:
- 3 users (1 admin + 2 customers)
- 128 books (deterministic)
- 30 orders with order items

**Files**:
- `app/data/setup.ts` - Seeding logic with `TRUNCATE ... CASCADE`
- `server.ts` - Handles `--seed --exit` flags

## Cart Bug Fix

**Issue**: Cart toggle button state not updating immediately after click.

**Root cause**: Race condition with pending state and artificial delays in cart button component.

**Fix** (`app/assets/cart-button.tsx`):
- Removed unnecessary pending state ("Saving...")
- Removed artificial 500ms delay
- Simplified to: send request → reload frame on success

**Code pattern**:
```typescript
mix={on('click', async (_event, signal) => {
  let res = await fetch(routes.api.cartToggle.href(), {
    method: 'POST',
    body: formData,
    signal,
  })
  if (res.ok) {
    await handle.frame.reload()
  }
})}
```

## E2e Tests

Location: `e2e/cart-flow.spec.ts`

Tests cover:
- Add to cart → button changes to "Remove from Cart"
- Cart page shows added items
- Remove from cart → button changes back
- Cart state persists across page navigation
- Multiple add/remove cycles
- Empty cart handling

Run: `pnpm run test:e2e -- cart-flow.spec.ts`

## Related

- `bookstore/README.md` - Setup and running
- `development/remix3/guides/demo-patterns.md` - Full pattern reference
