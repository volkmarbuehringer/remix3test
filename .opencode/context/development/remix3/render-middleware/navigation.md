<!-- Context: development/remix3/render-middleware | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Render Middleware (@remix-run/render-middleware)

**Core Idea**: Middleware that creates request-scoped `data → Response` functions (renderers) and attaches them to `fetch-router` request context. Decouples route handlers from rendering logic — handlers call `context.render(value)` without knowing how the Response is built.

## Quick Links

| Task | File |
|------|------|
| `Renderer<input, init>` interface — typed data→Response contract | `concepts/renderer-pattern.md` |
| `renderWith(factory)` — middleware that creates & installs renderers | `concepts/render-with.md` |
| Usage: string renderer, JSON renderer with custom options, Remix UI renderer | `examples/using-renderers.md` |
| Quick API reference: types, imports, signatures | `lookup/api.md` |

## Source

- Package source: `~/remix/packages/render-middleware/`
- Core implementation: `src/lib/render.ts` (42 lines)
- Exports: `src/index.ts` — `Renderer`, `renderWith`, `AnyRenderer` (type)
- Tests: `src/lib/render.test.ts` (141 lines)

## Related

- `../fetch-router/concepts/request-context.md` — `RequestContext`, `createContextKey`, `property` accessor
- `../fetch-router/guides/middleware.md` — Middleware system that `renderWith` plugs into
- `../fetch-router/guides/typed-context.md` — Deriving context types from middleware tuples including renderer middleware
- `../node-fetch-server/concepts/request-response.md` — Request/Response lifecycle renderers participate in
