<!-- Context: frames/errors/resolve-frame-not-using-context | Priority: medium | Version: 2.0 | Updated: 2026-05-01 -->

# ResolveFrameContext — No Longer a Parameter

**Status**: This was a v1 parameter that has been removed in v2.

**Historical Context**: In v1, `resolveFrame` received `(src, target, context: ResolveFrameContext)` parameters. The context provided `currentFrameSrc` for nested frame URL resolution. In v2, the `ResolveFrameContext` parameter was removed because nested frame URL resolution uses `frameSrc: request.url` consistently.

## Current Pattern — No Context Parameter

```typescript
// ✅ v2 - Single src parameter, resolve relative to request.url
async function resolveFrame(router, request, src) {
  let url = new URL(src, request.url)
  // Nested frames also use request.url — frameSrc seeds SSR state
}
```

The `renderToStream` `frameSrc` option seeds SSR frame state. All frame URLs resolve from this consistent base, so `ResolveFrameContext` is no longer needed.

## What Changed

| Version | Parameter Signature |
|---------|-------------------|
| v1 | `resolveFrame(src, target?, context?: ResolveFrameContext)` |
| v2 | `resolveFrame(src)` — single parameter |

## Key Rule

Use `new URL(src, request.url)` for all frame URL resolution. Do not use `ResolveFrameContext` — it has been removed from the API.

## See Also

- `guides/render-utilities.md` — Current render utility patterns
- `guides/frame-resolution.md` — Simplified resolveFrame API
