<!-- Context: project-intelligence/newapp/concepts/dual-renderer | Priority: high | Version: 1.0 | Created: 2026-05-28 -->

# Concept: Dual Renderer Pattern — `context.render()` vs `context.json()`

**Core Idea**: The middleware chain installs two separate context properties for generating responses — `context.render(node, init?)` for HTML UI pages and `context.json(data, init?)` for JSON API responses. Both coexist on the same request context using different property names.

---

## Why Two Renderers?

In a Remix 3 app, route handlers need to produce two fundamentally different types of responses:

| Response Type | Used For | Context Property | Middleware |
|---------------|----------|-----------------|------------|
| **HTML** | Full pages, frame fragments, SSR UI | `context.render(node, init?)` | `render()` from `app/middleware/render.tsx` |
| **JSON** | API endpoints, AJAX responses, form validation errors | `context.json(data, init?)` | `json()` from `app/middleware/json-render.ts` |

Separating them avoids:
- **Mixing concerns**: A JSON endpoint shouldn't pay the cost of frame resolution and HTML rendering.
- **Type confusion**: `context.render()` accepts `RemixNode`; `context.json()` accepts `unknown`. They enforce different contracts.
- **Middleware coupling**: The JSON renderer doesn't depend on the render middleware's `renderWith` helper, avoiding circular or unnecessary dependencies.

## Design Decision: Direct `createContextKey` vs `renderWith`

The JSON renderer uses `createContextKey` directly from `remix/router` rather than the `renderWith` helper from `remix/middleware/render`:

```ts
// json-render.ts — uses createContextKey directly
const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()

export function json(): Middleware<{
  key: typeof JsonRenderer
  value: (data: unknown, init?: ResponseInit) => Response
  property: 'json'
}> {
  return (context, next) => {
    context.set(
      JsonRenderer,
      (data: unknown, init?: ResponseInit) => Response.json(data, init),
      { property: 'json' },
    )
    return next()
  }
}
```

**Why not `renderWith`?** `renderWith` hardcodes `property: 'render'` as the context property name in its type signature:

```ts
function renderWith<const renderer extends AnyRenderer>(
  createRenderer: RendererFactory<renderer>,
): Middleware<{ key: typeof Renderer; value: renderer; property: 'render' }>
//                                                                       ^^^^^^
//                                                                       hardcoded
```

Using `renderWith` for the JSON renderer would conflict with the existing UI render middleware, which already owns `property: 'render'`. Attempting to install two middleware with the same property name throws at runtime.

**Alternative considered**: Could have modified `renderWith` to accept a custom property name. Decided against it because:
- The existing `renderWith` API is stable and used by the UI renderer.
- The JSON renderer is simple enough (a thin `Response.json()` wrapper) that `createContextKey` is more appropriate than a generalized factory.
- Direct `createContextKey` usage is the canonical Remix 3 pattern — `renderWith` is a convenience on top of it.

## Type Safety: `unknown` not `any`

The JSON renderer declares its data parameter as `unknown` rather than `any`:

```ts
const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()
```

`unknown` is a **top type** (like `any`) — it accepts any value at the call site:

```ts
// ✅ These all compile — unknown accepts everything
context.json({ items: result.rows })
context.json({ error: 'not found' }, { status: 404 })
context.json("raw string")              // Also compiles
context.json(42)                        // Also compiles
```

So why `unknown` instead of `any`? Two reasons:

1. **Inside the function, `unknown` forces narrowing** — You can't pass `data` to something expecting `string` or call methods on it without a type assertion or check. `any` silently lets you do anything.

2. **Semantic signal** — `unknown` says "this function truly doesn't care about the shape; it just serializes what it gets." `any` would be technically the same but communicates "we've given up on types here." The `Response.json()` call handles serialization of any value correctly.

The real type safety comes from the **type inference** at each call site: when you call `context.json({ items })`, TypeScript knows the return type is `Response` regardless, but it checks the argument is valid JavaScript for `JSON.stringify`. Using `unknown` for the parameter type is a deliberate design choice that follows the Remix 3 convention of explicit types over implicit `any`.

## When to Use Each

| Situation | Use |
|-----------|-----|
| Full page render | `context.render(<Page />)` |
| Frame fragment | `context.render(<FrameContent />)` |
| JSON API response | `context.json({ data })` |
| Error response (JSON API) | `context.json({ error: msg }, { status: 400 })` |
| Error response (HTML) | `context.render(<ErrorPage />, { status: 500 })` |
| Redirect | `redirect('/path')` (uses `Location` header, not a renderer) |

## Real-World Usage

`context.json()` is used extensively across the codebase (98+ calls in 10 controllers):

- **`app/actions/admin-nutzer-controller.tsx`** — JSON endpoints for user management (lock/unlock, activate/deactivate, password reset). Returns `{ ok: boolean }` responses.
- **`app/actions/appointment-controller.tsx`** — JSON API for appointment CRUD. Returns `{ appointment }`, `{ error }`, or `{ id }` with appropriate status codes.
- **`app/actions/appointtype-controller.tsx`** — JSON API for appointment types. Returns `{ type }` or `{ deleted: true }`.
- **`app/actions/admin-offerings-controller.tsx`** — JSON endpoints for offerings grid with `{ rows, total }` paginated responses.
- **`app/actions/lists-controller.tsx`** — JSON API for list management.
- **`app/actions/chat-controller.tsx`** and **`agent-controller.tsx`** — JSON error responses for rate limiting and validation.
- **`app/actions/workflow-controller.tsx`** — JSON validation errors.
- **`app/actions/client/controller.tsx`** — JSON success/error responses for client CRUD operations.

## How Both Renderers Fit in the Middleware Chain

The middleware stack installs renderers in order — both are available to every downstream handler:

```
render()            → context.render        (HTML UI rendering)
  ↓
json()              → context.json          (JSON API responses)
```

Because they use different property names (`'render'` vs `'json'`), there's no conflict. Handlers can even use both in the same request:

```ts
async update(context) {
  let { render, json, db, formData } = context
  let data = parseForm(formData)
  try {
    await db.update(table, data)
    // JSON response for AJAX form submission
    return json({ ok: true })
  } catch (err) {
    // HTML fallback for non-JS clients
    return render(<ErrorPage error={err} />, { status: 422 })
  }
}
```

## 📂 Codebase References

- **JSON render implementation**: `app/middleware/json-render.ts` — 29 lines
- **UI render implementation**: `app/middleware/render.tsx` — 116 lines
- **Middleware stack**: `app/router.ts` — Lines 76-77, `render()` and `json()` in sequence
- **Context type**: `app/types/context.ts` — `json()` added to `RootMiddleware` tuple
- **JSON render usage**: 98+ calls across `app/actions/*-controller.tsx` files

## Related Context

- [Middleware Chain](./middleware-chain.md) — Where both renderers are installed
- [Context Access Patterns](./context-access-patterns.md) — How to use context.json() in controllers
- [Controller Example](../examples/controller-example.md) — Examples of both renderers in actions
- [Render Middleware Pattern](../../../development/remix3/render-middleware/concepts/render-with.md) — The `renderWith` helper that the UI renderer uses
- [Request Context](../../../development/remix3/fetch-router/concepts/request-context.md) — `createContextKey` and `context.set` with `property` option
