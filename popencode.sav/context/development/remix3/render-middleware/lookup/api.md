<!-- Context: development/remix3/render-middleware/lookup/api | Priority: medium | Version: 1.0 -->

# API Reference — @remix-run/render-middleware

## Quick Lookup

| Export | Kind | Signature |
|--------|------|-----------|
| `Renderer<input, init>` | Interface | `(input: input, init?: responseInit) => Response \| Promise<Response>` |
| `AnyRenderer` | Type alias | `Renderer<never, never>` |
| `Renderer` | Context key | `createContextKey<AnyRenderer>()` — use with `context.get(Renderer)` |
| `renderWith(factory)` | Function | `(factory: RendererFactory<T>) => Middleware<{key, value, property: 'render'}>` |
| `RendererFactory<T>` | Type (internal) | `(context: RequestContext<any, any>) => T` |

## Imports

```ts
import { Renderer, renderWith } from '@remix-run/render-middleware'
import type { AnyRenderer } from '@remix-run/render-middleware'
```

## Context Access Patterns

```ts
// Pattern A — Typed context key
context.get(Renderer)(data, options?)

// Pattern B — Convenience property (installed by middleware)
context.render(data, options?)
```

## Middleware Registration

```ts
// Factory receives request context for scoping
let mw = renderWith((context) => (value: string) =>
  new Response(`${context.url.pathname}:${value}`)
)

// Include in router middleware tuple
let router = createRouter({ middleware: [mw] })
// Type-system extracts the middleware's entry:
// { key: typeof Renderer, value: (value: string) => Response, property: 'render' }
```

## Related

- [Renderer Pattern](../concepts/renderer-pattern.md) — Interface design
- [renderWith Concept](../concepts/render-with.md) — Middleware behavior
- [Usage Examples](../examples/using-renderers.md) — Runnable patterns
- [fetch-router Typed Context](../../fetch-router/guides/typed-context.md) — `MiddlewareContext` derivation
