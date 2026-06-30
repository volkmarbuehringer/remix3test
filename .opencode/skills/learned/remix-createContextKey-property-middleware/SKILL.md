---
name: remix-createContextKey-property-middleware
description: "Use createContextKey not Symbol for Remix 3 middleware that exposes typed context properties"
user-invocable: false
origin: auto-extracted
---

# Use createContextKey not Symbol for Middleware Context Properties

**Extracted:** 2026-06-04
**Context:** Adding custom middleware (mailer) that exposes a typed `context.mailer` property

## Problem

When adding custom middleware that should expose a typed property on the request context (e.g. `context.mailer`), using `Symbol` as the context key causes TypeScript errors:

```ts
// ❌ Does NOT work
export const Mailer = Symbol('mailer')
context.set(Mailer, sendEmail, { property: 'mailer' })
// Error: Symbol is not assignable to parameter of type 'object'
```

The Remix type system expects context keys to be `object` types, and `Symbol` is a `symbol`, not an `object`.

## Solution

Use `createContextKey` from `remix/router` to create a typed context key, then use it with `Middleware<{ key; value; property }>` and `context.set()`:

```ts
import { createContextKey, type Middleware } from 'remix/router'

// 1. Create a typed context key
const MailerContext = createContextKey<SendEmailFn>()

// 2. Use with Middleware generic and property name
export function mailer(): Middleware<{
  key: typeof MailerContext
  value: SendEmailFn
  property: 'mailer'       // ← becomes accessible as context.mailer
}> {
  let sendEmail = createSendEmail(transport)
  return async (context, next) => {
    context.set(MailerContext, sendEmail, { property: 'mailer' })
    return next()
  }
}
```

The `property` name automatically becomes a typed property on the context. No `declare module` augmentation needed.

## Reference: app/middleware/json-render.ts
```ts
const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()

export function json(): Middleware<{
  key: typeof JsonRenderer
  value: (data: unknown, init?: ResponseInit) => Response
  property: 'json'
}> {
  return (context, next) => {
    context.set(JsonRenderer, (data, init) => Response.json(data, init), { property: 'json' })
    return next()
  }
}
// Enables: context.json({ ok: true })
```

---

## Avoiding Circular Dependencies

When deriving `AppContext` from `createMiddleware()`, placing the middleware factory in `router.ts` and re-exporting its type from `types/context.ts` creates a circular dependency:

```
router.ts → controllers → types/context.ts → router.ts
```

TypeScript silently resolves `AppContext` to `DefaultContext` — middleware-provided properties (`context.formData`, `context.auth`, `context.render`) disappear from the type system.

### Solution: One-directional dependency flow

Place `createNewappMiddleware()` in a file with no dependency on `router.ts` or controllers:

```
app/middleware/root.ts         ← createNewappMiddleware() lives here
app/types/context.ts           ← imports from root.ts, derives AppContext
app/router.ts                  ← imports from both
```

Dependency flow:
```
router.ts → middleware/root.ts + types/context.ts → middleware/*.ts
```

```typescript
// app/middleware/root.ts
// Imports only from remix/* and sibling middleware — NO router/controller imports
import { createMiddleware } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'

export function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(formData(), session(cookie, storage), loadDatabase(), loadAuth())
}
```

```typescript
// app/types/context.ts — type-only import, erased at runtime
import type { MiddlewareContext } from 'remix/router'
import type { createNewappMiddleware } from '../middleware/root.ts'
export type AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>
```

```typescript
// app/router.ts — no cycle
import { createRouter } from 'remix/router'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'
```

**When to use:** Migrating to `createMiddleware()`, when the factory accepts parameters, whenever `export type { AppContext } from '../router.ts'` appears in `context.ts`, or if TypeScript reports "Property 'formData' does not exist on type 'RequestContext<{}...'" after refactoring.

## When to Use

- Adding custom middleware that should expose a typed function or value on `context`
- Any time a middleware creates a per-request service (mailer, cache, feature flags)
- Do NOT use `Symbol` for context keys — use `createContextKey` instead
