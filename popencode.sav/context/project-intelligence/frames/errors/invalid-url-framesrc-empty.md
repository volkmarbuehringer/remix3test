<!-- Context: frames/errors/invalid-url-framesrc-empty | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Invalid URL - frameSrc Empty in Fragments

**Symptom**: `TypeError: Invalid URL` when rendering fragments.

**Root Cause**: `frameSrc` was empty in fragment responses because fragments are rendered without a page context. `renderToStream` needs `frameSrc` for resolving nested frame URLs.

```typescript
// renderToStream called in fragment without frameSrc
let stream = renderToStream(node, {
  // frameSrc needed for nested frames in fragments
  frameSrc: request.url,  // Add this
})
```

**Affected Files**: `bookstore/app/utils/render.tsx`

## Key Rule

Always pass `frameSrc: request.url` to `renderToStream` when rendering fragments, so nested frame URLs resolve correctly relative to the fragment's URL.

## See Also

- `errors/resolve-frame-not-using-context.md` - Context for nested URL resolution
- `guides/nested-frames.md` - renderFragment setup
