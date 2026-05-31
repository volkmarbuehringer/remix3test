<!-- Context: development/remix3/render-middleware/concepts/renderer-pattern | Priority: medium | Version: 1.0 -->

# Renderer Pattern — `Renderer<input, responseInit>` Interface

A `Renderer` is any callable interface that converts application data into a `Response`. It's a generic contract that decouples route handlers from rendering logic.

## Core Concept

```ts
interface Renderer<input = unknown, responseInit = ResponseInit> {
  (input: input, init?: responseInit): Response | Promise<Response>
}
```

Handlers produce data; renderers convert data to responses. A route handler never calls `new Response()` directly — it calls `context.render(data, options?)` and trusts the renderer to build the wire format.

## Key Points

- **Framework-agnostic**: Renderers can produce any Response — HTML, JSON, text, XML, binary. The interface doesn't care about format.
- **Input generic (`input`)**: Each renderer declares the data type it accepts. A string renderer has `Renderer<string>`, a JSON renderer has `Renderer<{ ok: boolean }>`. Wrong input types are caught at compile time.
- **Options generic (`responseInit`)**: Extends `ResponseInit` for renderer-specific options (e.g., `{ pretty?: boolean }` for JSON formatting). Defaults to `ResponseInit`.
- **`AnyRenderer = Renderer<never, never>`**: Type-erased variant for storage in context keys. Calling it with `never` means it can only be invoked after casting — the middleware system handles the cast via `renderWith`'s type inference.

## Reference

- Source: `~/remix/packages/render-middleware/src/lib/render.ts` (lines 6-20)
- Import: `import { type Renderer, type AnyRenderer } from '@remix-run/render-middleware'`

## Related

- [renderWith Middleware](render-with.md) — How renderers get created and installed
- [Usage Examples](../examples/using-renderers.md) — String, JSON, and UI renderers in practice
- [API Reference](../lookup/api.md) — Full type signatures
