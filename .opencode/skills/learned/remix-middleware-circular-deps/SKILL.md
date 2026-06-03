---
name: remix-middleware-circular-deps
description: "Avoid circular type resolution failures when deriving AppContext from createMiddleware() in Remix 3"
user-invocable: false
origin: auto-extracted
---

# Remix 3 Middleware Context Circular Dependencies

**Extracted:** 2026-06-03
**Context:** Refactoring a Remix 3 app to use `createMiddleware()` factory for `AppContext` type derivation.

## Problem

When using `createMiddleware()` to derive `AppContext` in a Remix 3 project, placing the middleware factory in `app/router.ts` and re-exporting the type from `app/types/context.ts` creates a circular dependency:

```
router.ts → controllers → types/context.ts → router.ts
```

TypeScript resolves `AppContext` silently to `DefaultContext` instead of the intended middleware-derived type. Middleware-provided context properties (`context.formData`, `context.auth`, `context.db`, `context.render`) disappear from the type system — surfacing as runtime property-not-found errors at compile time with no obvious connection to the import structure.

## Why It Happens

`router.ts` imports controllers for `router.map()` calls. Controllers import `AppContext` from `types/context.ts` for their generic type parameters. If `context.ts` re-exports from `router.ts` (`export type { AppContext } from '../router.ts'`), the import cycle prevents TypeScript from resolving the full type.

This is especially common with parameterized middleware factories:
```ts
function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(formData(), session(cookie, storage), ...)
}
// ❌ Don't put this in router.ts and re-export its type from context.ts
```

## Solution

Place the middleware factory in a file with no dependency on `router.ts` or controllers:

```
app/middleware/root.ts         ← createNewappMiddleware() lives here
app/types/context.ts           ← imports from root.ts, derives AppContext
app/router.ts                  ← imports from both root.ts and context.ts
```

Dependency flow is one-directional:
```
router.ts → middleware/root.ts + types/context.ts → middleware/*.ts
```

### Concrete example

```ts
// app/middleware/root.ts
// Imports only from remix/* and sibling middleware files
// Does NOT import from router.ts, context.ts, or any controller
import { createMiddleware } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { session } from 'remix/middleware/session'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'

export function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(
    formData(),
    session(cookie, storage),
    loadDatabase(),
    loadAuth(),
    // ...
  )
}
```

```ts
// app/types/context.ts
// Type-only import — erased at runtime, no cycle
import type { MiddlewareContext } from 'remix/router'
import type { createNewappMiddleware } from '../middleware/root.ts'

export type AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>
```

```ts
// app/router.ts
import { createRouter } from 'remix/router'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'

// Controller imports are fine — they depend on context.ts, not the reverse
import controller from './actions/controller.tsx'

// No cycle: router.ts → middleware/root.ts, router.ts → context.ts
// context.ts → middleware/root.ts
// controllers → context.ts
```

## When to Use

- When migrating from manual `MiddlewareContext<[ReturnType<...>]>` tuples to `createMiddleware()` in Remix 3
- When the middleware factory accepts parameters (cookie, storage, etc.) and can't be a plain constant array
- Whenever `export type { AppContext } from '../router.ts'` appears in `context.ts` — suspect a pending circular dependency
- If TypeScript reports "Property 'formData' does not exist on type 'RequestContext<{}...'" after a refactoring that moved middleware types — check for circular imports first
