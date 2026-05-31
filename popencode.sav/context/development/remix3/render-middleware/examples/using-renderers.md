<!-- Context: development/remix3/render-middleware/examples/using-renderers | Priority: medium | Version: 1.0 -->

# Using Renderers — Three Patterns

## 1. Simple String Renderer

Creates a `Response` from a plain string. Demonstrates the minimal setup — factory ignores context, renderer accepts `string` with optional `ResponseInit`.

```ts
import { createRouter } from '@remix-run/fetch-router'
import { renderWith } from '@remix-run/render-middleware'

let render = renderWith(() => (value: string, init?: ResponseInit) =>
  new Response(value, init)
)

let router = createRouter({ middleware: [render] })
router.get('/', (ctx) => ctx.render('Hello', { status: 201 }))
// → 201 Response, body: "Hello"
```

## 2. JSON Renderer with Custom Options

Extends `ResponseInit` with a `pretty` flag. The renderer type propagates so custom options are type-checked at the handler site.

```ts
let json = renderWith(() =>
  (value: { ok: boolean }, init?: ResponseInit & { pretty?: boolean }) => {
    let body = init?.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)
    return new Response(body, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
  }
)

let router = createRouter({ middleware: [json] })
router.get('/json', (ctx) => ctx.render({ ok: true }, { pretty: true }))
// → 200 Response, body: '{\n  "ok": true\n}', Content-Type: application/json
```

## 3. Remix UI Renderer with Frame Resolution

A production renderer that resolves Remix route frames and HTML-renders the response. This shows how renderers bridge data generation (route logic) and response formatting (HTML template).

```ts
// Conceptual — uses @remix-run/html-template and frame resolution
let render = renderWith((context) => (value: { page: string; data: unknown }) => {
  // Resolve the frame for the matched route
  let frame = context.get(FrameRenderer)(value.page)
  // Render frame attributes + data into an HTML template
  return renderFrame(frame, value.data, {
    styles: context.get(StyleResolver),
    scripts: context.get(ScriptResolver),
  })
})

// Handler only deals with data, not HTML
router.get('/products/:id', (ctx) => {
  let product = db.products.find(ctx.params.id)  // ← data concern
  return ctx.render({ page: 'product', data: product })  // ← delegates rendering
})
```

## Type Inference in Action

The `const` generic in `renderWith` preserves exact types. The test suite verifies:

```ts
// ❌ Compile error: Renderer input is checked.
context.render('wrong-type-here')  // fails if renderer expects { ok: boolean }
```
