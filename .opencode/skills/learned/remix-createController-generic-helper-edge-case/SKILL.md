---
name: remix-createController-generic-helper-edge-case
description: "Keep explicit generics on createController() when passing context.auth to typed helper functions in Remix 3"
user-invocable: false
origin: auto-extracted
---

# Remix 3: Explicit Generics Required on createController() with Typed Helpers

**Extracted:** 2026-06-05
**Context:** When removing redundant `<typeof routes.x, AppContext>` generics from `createController()` calls after configuring `DefaultContext` via module augmentation

## Problem

After configuring `RouterTypes.context` to resolve to `AppContext` (making explicit generics on `createController()` redundant), removing the generic from files that pass `context.auth` to a typed helper function produces a TypeScript error:

```
error TS2345: Argument of type 'GoodAuth<unknown>' is not assignable
to parameter of type 'AuthState<User> | undefined'
```

This happens because removing the generic causes `context.auth` to resolve as `GoodAuth<unknown>` instead of `GoodAuth<User>`. The `User` type parameter doesn't propagate through `MiddlewareContext` folding — only the top-level context type is fixed by `DefaultContext`.

## Solution

**Keep the explicit generic on `createController()`** in any file that passes `context.auth` to a helper function expecting `AuthState<User>`:

```typescript
// ❌ BROKEN — context.auth becomes GoodAuth<unknown>
export default createController(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async destroy(context) {
      // getAdminIdentity expects AuthState<User>, gets GoodAuth<unknown>
      let identity = getAdminIdentity(context.auth) // TS error
    },
  },
})

// ✅ CORRECT — explicit generic preserves the User type
export default createController<typeof routes.admin.users, AppContext>(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async destroy(context) {
      let identity = getAdminIdentity(context.auth) // GoodAuth<User> — OK
    },
  },
})
```

## When to Use

- You're removing explicit `<typeof routes.x, AppContext>` generics from `createController()` calls
- The controller passes `context.auth` (or other middleware-provided typed properties) to a helper function with a specific type parameter (e.g., `getAdminIdentity(auth: AuthState<User>)`, `logAdminAction(pool, { ...getAdminIdentity(context.auth) ... })`)
- Inline `context.auth` usage (e.g., `let auth = context.auth; if (!auth?.ok) ...`) works fine without the generic — only helper function calls break
