<!-- Context: development/remix3/guides/api-route-security | Priority: critical | Version: 1.0 | Updated: 2026-03-26 -->

# API Route Security

> Critical: Custom actions MUST have explicit middleware. Never assume routes are protected by default.

## Problem: Hidden Vulnerability

Routes in `api/` controllers often lack middleware, allowing any authenticated user to:

- Modify book prices to $0.01
- Grant themselves admin privileges
- Change any user's email

## Root Cause

`resources()` helper only creates standard CRUD routes (index, show, create, update, destroy). **Custom actions** (updateTitle, updatePrice, updateRole) are NOT protected by default.

## Pattern: Explicit Routes with Middleware

### ❌ Vulnerable: Custom action without middleware

```typescript
// routes.ts
api: route('api', {
  cartToggle: post('/cart/toggle'),
  updateBookTitle: post('/books/:bookId/title'), // ← No middleware!
  updateUserRole: post('/users/:userId/role'), // ← No middleware!
})

// api/controller.tsx
export default {
  actions: {
    async updateUserRole({ get, params, request }) {
      // Any authenticated user can call this!
      let body = await request.json()
      await db.update(users, userId, { role: body.role })
    },
  },
}
```

### ✅ Secure: Custom action in protected controller

```typescript
// routes.ts
admin: route('admin', {
  books: {
    index: get('/books'),
    // ... CRUD routes ...
    updateTitle: post('/books/:bookId/title'), // Explicit route
    updatePrice: post('/books/:bookId/price'), // in admin section
    updateStock: post('/books/:bookId/stock'),
  },
})

// admin/books/controller.tsx
export default {
  middleware: [requireAuth(), requireAdmin()], // ✅ Protected
  actions: {
    async updateTitle({ get, params, request }) {
      /* safe */
    },
  },
}
```

## Rule: Three-Part Checklist for Custom Actions

For ANY action beyond standard CRUD:

| #   | Requirement          | Question                                                                |
| --- | -------------------- | ----------------------------------------------------------------------- |
| 1   | **Explicit route**   | Is it defined in `routes.ts`?                                           |
| 2   | **Middleware**       | Does the controller have `middleware: [requireAuth(), requireAdmin()]`? |
| 3   | **Frontend updated** | Does the UI call `routes.admin.*` not `routes.api.*`?                   |

## Memory Leak: Unbounded Caches

### ❌ Bad: Module-level Map caches

```typescript
// admin/utils.ts
const sortUrlCache = new Map<string, string>() // Grows forever!
const sortPageUrlCache = new Map<string, string>() // Never cleared!

export function buildSortUrl(baseUrl, column, sort) {
  let cached = sortUrlCache.get(key) // Cache hit
  if (cached) return cached
  // ... build URL ...
  sortUrlCache.set(key, url) // Memory grows indefinitely
}
```

### ✅ Good: No caching, or bounded LRU

```typescript
// Simple: don't cache URL building (it's cheap!)
export function buildSortUrl(baseUrl, column, sort) {
  let direction = sort.column === column && sort.direction === 'asc' ? 'desc' : 'asc'
  return `${baseUrl}?sort=${encodeURIComponent(column)}&dir=${direction}`
}

// Or: Use lru-cache npm package with size limit
import { LRU } from 'lru-cache'
const cache = new LRU({ max: 100 }) // Bounded cache
```

## JSON.parse Error Handling

### ❌ Bad: No try-catch

```typescript
async show({ params }) {
  let order = await db.find(orders, orderId)
  let shipping = JSON.parse(order.shipping_address_json)  // Throws if malformed!
}
```

### ✅ Good: Graceful error handling

```typescript
async show({ params }) {
  let order = await db.find(orders, orderId)
  let shippingAddress: { street: string; city: string; zip: string }
  try {
    shippingAddress = JSON.parse(order.shipping_address_json)
  } catch {
    return new Response('Invalid shipping address data', { status: 500 })
  }
}
```

## Quick Security Checklist

- [ ] All `/api/*` routes require `requireAuth()` middleware
- [ ] Admin-only actions have `requireAdmin()` middleware
- [ ] No module-level `Map` or `Set` caches without bounds
- [ ] All `JSON.parse()` wrapped in try-catch
- [ ] Custom actions use explicit route definitions (not just `resources()`)
- [ ] Frontend calls protected routes (`routes.admin.*`) not `routes.api.*` for sensitive operations

## 📂 Codebase References

**Vulnerability Found**: `demos/bookstore/app/routes.ts` - API routes without middleware  
**Secure Pattern**: `demos/bookstore/app/controllers/admin/` - Controllers with middleware  
**Fix Applied**: `demos/bookstore/app/controllers/admin/books/controller.tsx`, `admin/users/controller.tsx`

## Related Files

