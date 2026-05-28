<!-- Context: development/remix3/fetch-router/guides/typed-context | Priority: medium | Version: 1.0 -->

# Typed Context — Deriving Middleware Context Types

Derive the cumulative context type from a middleware tuple using `MiddlewareContext`. Augment `RouterTypes` to flow context through all `createAction`/`createController`/verb registrations automatically.

## Key Points

- **`MiddlewareContext<MiddlewareTuple>`**: Resolves the cumulative context shape (keys + properties) from a tuple of middleware return types. Pass the tuple of middleware *instances*, not the factory generics.
- **`RouterTypes.context` augmentation**: Use `declare module 'remix/router' { interface RouterTypes { context: AppContext } }` to make the derived context available to all handler-registration methods.
- **`ContextWithParams<Base, Params>`**: Combines AppContext with route-specific params — for handlers that need both.
- **Middleware providers**: Factories that set context keys should accept `RouterTypes.context` in their generic parameter so downstream middleware/handlers see the augmented entries.

## Example

```ts
type RootMiddleware = [ReturnType<typeof loadSession>, ReturnType<typeof loadDb>]
type AppContext = MiddlewareContext<RootMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

// Now all createAction, createController, and verb method handlers
// automatically resolve to the full AppContext type.
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/middleware.ts`
- Import: `import type { MiddlewareContext, ContextWithParams } from 'remix/router'`

## Related

- [Middleware System](middleware.md) — Middleware factories and context transforms
- [Request Context](../concepts/request-context.md) — `createContextKey` and `get`/`set`/`has`
- [Controllers and Actions](controllers-and-actions.md) — Type-safe handler registration
