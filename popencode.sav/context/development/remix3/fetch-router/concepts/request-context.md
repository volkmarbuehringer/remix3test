<!-- Context: development/remix3/fetch-router/concepts/request-context | Priority: high | Version: 1.0 -->

# Request Context — `RequestContext` and `createContextKey`

Mutable request-scoped context object received by every handler and middleware. Provides typed data storage, URL parsing, and router access.

## Core Concept

`RequestContext<params, entries>` wraps a `Request` with parsed `URL`, route `params`, and a typed key-value store (`get`/`set`/`has`). Use `createContextKey<T>()` to generate type-safe access keys with optional property installation for ergonomic `ctx.propertyName` access.

## Key Points

- **Creation**: Constructed inside `router.fetch()` from the incoming `Request`. Contains `method`, `url`, `params`, `headers`, `request`, and `router`.
- **`createContextKey<T>(defaultValue?)`**: Returns a unique key symbol. `context.set(key, value, { property: 'db' })` installs a direct getter for `context.db`.
- **`get`/`set`/`has`**: Scoped to a single request lifecycle. `get()` returns `defaultValue` or `undefined` for keys set without a default.
- **`params` mutation**: Updated during nested route matching — merged from outer to inner matches.
- **Property conflicts**: Throws at runtime if two keys try to install the same property name.

## Example

```ts
let DbKey = createContextKey<Database>()

async function loadDb(ctx: RequestContext, next: NextFunction) {
  ctx.set(DbKey, await connectDb(), { property: 'db' })
  return next()
}

// Later in a handler:
async function handler(ctx: RequestContext) {
  let db = ctx.get(DbKey)  // typed Database
  let same = ctx.db        // same value via property access
}
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/request-context.ts`
- Import: `import { RequestContext, createContextKey } from 'remix/router'`

## Related

- [Middleware System](../guides/middleware.md) — How middleware populates context
- [Typed Context](../guides/typed-context.md) — Deriving AppContext from middleware tuples
