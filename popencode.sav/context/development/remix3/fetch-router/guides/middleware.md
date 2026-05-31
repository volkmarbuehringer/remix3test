<!-- Context: development/remix3/fetch-router/guides/middleware | Priority: high | Version: 1.0 -->

# Middleware System

Middleware wraps request handling in a chain of `(context, next) => Response` functions. Three nesting levels: global, controller, and action. All merge before dispatch.

## Key Points

- **`Middleware` interface**: `(context: RequestContext, next: NextFunction) => Response | void | undefined | Promise<...>`. Call `next()` to pass control. May return a response directly (short-circuit) or return next()'s response (decorate).
- **Three levels** (outer → inner): (1) Global — `createRouter({ middleware: [...] })`, runs on every request. (2) Controller — `controller.middleware`, runs for all controller actions. (3) Action — inline `{ middleware: [...], handler }`, runs for one action only.
- **Context transforms**: Middleware factories declare context effects via generic `<Middleware<{ key, value, property }>>`. Use `context.set(key, value, { property: 'name' })` to populate the context.
- **Short-circuit**: Return a `Response` directly from middleware (e.g., auth redirect) without calling `next()`.
- **Merging**: All three middleware arrays are concatenated in level order before the handler runs.

## Example

```ts
function logger(): Middleware {
  return async (ctx, next) => {
    let start = Date.now()
    let res = await next()
    console.log(`${ctx.method} ${res.status} ${Date.now() - start}ms`)
    return res
  }
}

function requireRole(role: string): Middleware {
  return async (ctx, next) => {
    if (ctx.get(UserKey)?.role !== role)
      return new Response('Forbidden', { status: 403 })
    return next()
  }
}
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/middleware.ts`
- Import: `import type { Middleware, NextFunction, MiddlewareContext } from 'remix/router'`

## Related

- [Typed Context](typed-context.md) — Deriving context types from middleware tuples
- [Controllers and Actions](controllers-and-actions.md) — Controller-level middleware
- [Request Context](../concepts/request-context.md) — Context object passed to middleware
