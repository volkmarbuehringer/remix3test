<!-- Context: development/remix3/render-middleware/concepts/render-with | Priority: medium | Version: 1.0 -->

# `renderWith(createRenderer)` — Middleware That Installs Renderers

`renderWith` takes a factory function that produces a request-scoped renderer and returns a `Middleware` that stores it in `RequestContext` for downstream handlers.

## Core Concept

```ts
function renderWith<const renderer extends AnyRenderer>(
  createRenderer: RendererFactory<renderer>,
): Middleware<{ key: typeof Renderer; value: renderer; property: 'render' }>
```

The factory `(context: RequestContext) => renderer` runs per-request, so renderers can inspect the URL, headers, cookies, or other context entries before producing responses. The middleware calls `context.set(Renderer, createRenderer(context), { property: 'render' })`.

## Key Points

- **Request-scoped**: The factory receives the full `RequestContext`, enabling renderers to use request data (e.g., `context.url.pathname` for path-aware rendering).
- **`const` type parameter**: The `const` modifier preserves the exact literal type of the renderer through the middleware chain, so downstream handlers see the precise input/output types.
- **Dual access**: After middleware runs, handlers can access the renderer via `context.get(Renderer)` (typed) **and** `context.render(...)` (convenience property). Both resolve to the same function.
- **`property: 'render'`**: The third argument to `context.set()` installs a direct accessor. If two middleware try to install the same property name, it throws at runtime.
- **Middleware return type**: `Middleware<{ key, value, property }>` lets the fetch-router type system derive the cumulative context shape when combined with other middleware via `MiddlewareContext`.

## Reference

- Source: `~/remix/packages/render-middleware/src/lib/render.ts` (lines 36-41)
- Import: `import { renderWith } from '@remix-run/render-middleware'`

## Related

- [Renderer Interface](renderer-pattern.md) — The renderer contract
- [Request Context](../../fetch-router/concepts/request-context.md) — How `createContextKey` and `context.set` work
- [Middleware System](../../fetch-router/guides/middleware.md) — Where `renderWith` middleware plugs in
- [Typed Context](../../fetch-router/guides/typed-context.md) — Deriving context from middleware tuples
