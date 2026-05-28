<!-- Context: frame-navigation/lookup/type-augmentation | Priority: high | Version: 1.0 | Updated: 2026-03-23 -->

# Type Augmentation Patterns

Module augmentation for extending third-party types at runtime.

## RequestContext Augmentation

Add custom properties to `RequestContext`:

```typescript
// app/types/context.db.ts
import type { Database } from 'remix/data-table'
import type { User } from '../data/schema.ts'

declare module 'remix/fetch-router' {
  interface RequestContext {
    db: Database
    userId: number | null
    user: User | null
  }
}
```

## Usage in Middleware

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
  // ctx.user is typed as User | null
}
```

## Module Resolution

File must be imported in router:

```typescript
// config/router.tsx
import '../app/types/context.db.ts'
```

## Augmentation Pattern

| Step | Action                                             |
| ---- | -------------------------------------------------- |
| 1    | Create `app/types/context.{name}.ts`               |
| 2    | Import original type                               |
| 3    | `declare module 'package' { interface X { ... } }` |
| 4    | Import in router to activate                       |

## Reference

- `demos/frame-navigation/app/types/context.db.ts`
- `demos/frame-navigation/config/router.tsx`
