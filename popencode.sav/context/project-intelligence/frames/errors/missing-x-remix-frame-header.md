<!-- Context: frames/errors/missing-x-remix-frame-header | Priority: medium | Version: 2.0 | Updated: 2026-05-01 -->

# x-remix-frame Header — No Longer Needed in resolveFrame

**Status**: This was a v1 requirement that has been removed in v2.

**Historical Context**: In v1, `resolveFrame()` needed to send `x-remix-frame: true` to distinguish frame requests from full-page requests. In v2, the framework's internal routing handles frame identification, and user `resolveFrame` implementations no longer need to set this header.

## Current Pattern — No Header Required

```typescript
// ✅ v2 - No x-remix-frame header needed
async function resolveFrame(router, request, src) {
  let url = new URL(src, request.url)
  let headers = new Headers()
  headers.set('accept', 'text/html')
  // No x-remix-frame header required — framework handles it
  let res = await router.fetch(new Request(url, { method: 'GET', headers }))
}
```

## What Changed

| Version | Pattern |
|---------|---------|
| v1 | Required `headers.set('x-remix-frame', 'true')` |
| v2 | No header needed — framework handles frame identification |

## Key Rule

Do NOT set `x-remix-frame` or `x-remix-target` headers in `resolveFrame`. The framework identifies frame requests internally.

## See Also

- `guides/render-utilities.md` — Current render utility patterns
- `guides/frame-resolution.md` — Simplified resolveFrame API
