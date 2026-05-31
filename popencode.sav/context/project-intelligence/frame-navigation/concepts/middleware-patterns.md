<!-- Context: frame-navigation/concepts/middleware | Priority: critical | Version: 1.0 | Updated: 2026-03-23 -->

# Middleware Patterns

Authentication and authorization middleware for frame-based Remix apps.

## Core Pattern

Middleware chain in `config/router.tsx`:

```typescript
middleware.push(requireAuth) // Load user into ctx
middleware.push(requireAdmin) // Check admin role
```

## requireAuth Middleware

Loads user once, caches in `ctx.user`:

```typescript
let requireAuth: Middleware = async (ctx, next) => {
  ctx.userId = null
  ctx.user = null

  let cookie = await authCookie.parse(ctx.request.headers.get('cookie'))
  if (cookie) {
    let userId = parseInt(cookie, 10)
    if (!isNaN(userId) && userId > 0) {
      ctx.userId = userId
      if (ctx.db) {
        ctx.user = await ctx.db.findOne(users, { where: { id: userId } })
      }
    }
  }

  if (!ctx.userId) {
    return redirect(loginPath)
  }
  return next()
}
```

## requireAdmin Middleware

Checks admin role AFTER `requireAuth` runs:

```typescript
let requireAdmin: Middleware = async (ctx, next) => {
  if (!ctx.url.pathname.startsWith('/admin')) {
    return next() // Skip non-admin routes
  }
  if (!ctx.user || ctx.user.role !== 'admin') {
    return redirect(loginPath)
  }
  return next()
}
```

## Key Points

- User loaded once in `requireAuth`, reused in `requireAdmin`
- Frame requests (header `x-remix-frame: true`) get HTML error response
- Non-frame requests get redirect to login
- Order matters: `requireAuth` → `requireAdmin`

## Type Augmentation

```typescript
// app/types/context.db.ts
declare module 'remix/fetch-router' {
  interface RequestContext {
    db: Database
    userId: number | null
    user: User | null
  }
}
```

## Reference

- `demos/frame-navigation/config/router.tsx`
- `demos/frame-navigation/app/types/context.db.ts`
