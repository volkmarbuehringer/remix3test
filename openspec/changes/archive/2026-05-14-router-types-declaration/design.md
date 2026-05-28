## Context

The `remix/async-context-middleware` package's `getContext()` function returns type `AsyncRequestContext`, which resolves through the global `RouterTypes` interface:

```ts
// In async-context-middleware:
type AsyncRequestContext = RouterTypes extends {
  context: infer context extends RequestContext<any, any>
} ? ContextWithEntries<RequestContext<AnyParams>, entries>
  : RequestContext<AnyParams>
```

When `RouterTypes.context` is set to `AppContext`, the `getContext()` call returns a type with all middleware entries (and thus all direct properties like `session`, `auth`, `db`). When it's not set, `getContext()` falls back to `RequestContext<AnyParams>` with empty entries — which is the current state in newapp.

All 7 remix demos augment `RouterTypes` in their `router.ts`:

```ts
declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

This is a global type augmentation — it works via TypeScript's interface merging. It doesn't add any runtime code.

## Goals / Non-Goals

**Goals:**
- Add the `declare module` type augmentation to `app/router.ts`
- Re-convert the 3 reverted files to use direct properties through `getContext()`
- Remove unnecessary `Session` and `Auth` imports from those files
- Zero behavioral changes

**Non-Goals:**
- Not changing `middleware/admin.ts` or `middleware/auth.ts` — standalone middleware contexts still can't use direct properties (their `context` parameter has an anonymous type regardless of `RouterTypes`)
- Not changing controller destructuring patterns — that's a separate style concern

## Decisions

**Decision 1: Add the declaration to `app/router.ts`**

Following the demo pattern precisely:

```ts
declare module 'remix/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

This must go in `router.ts` because that's where `AppContext` is defined and `createRouter` is called. The existing `import type { MiddlewareContext } from 'remix/fetch-router'` already provides access to the module for declaration merging.

**Decision 2: Re-convert 3 files to direct properties**

Once the type augmentation is in place:
- `actions/auth-logout.tsx`: `getContext().get(Session)` → `getContext().session`, remove `Session` import
- `utils/context.ts`: `getContext().get(Auth)` → `getContext().auth`, remove `Auth` import
- `utils/error-handling.ts`: `getContext().get(Session)` → `getContext().session`, remove `Session` import

These are the same changes that were reverted during the `migrate-context-properties` change.

**Decision 3: Leave middleware files as-is**

`middleware/admin.ts` and `middleware/auth.ts` use `context.get(Auth)`, `context.get(Database)`, `context.get(FormData)`, `context.get(Renderer)` in callback contexts where the `context` parameter has type `RequestContext<any, any>` or `RequestContext<{}, []>`. These are not affected by `RouterTypes` — they're function parameter types, not `getContext()` return types. The `declare module` pattern doesn't help here, so these stay on `context.get()`.

## Risks / Trade-offs

- **[Low] Name collision** — `RouterTypes` is an exported interface from `remix/fetch-router`. The `declare module` augmentation merges with it. If another declaration tries to augment the same interface with a different `context` type, there would be a conflict. In practice, newapp only has one router, so this isn't a concern.
- **[None] Runtime impact** — TypeScript type declarations are erased at compile time. There's no runtime cost.
- **[None] Breaking existing code** — The augmentation only adds a type. All existing `context.get(Key)` calls continue to work.
