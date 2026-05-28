<!-- Context: frames/errors/resolve-frame-returning-html-error | Priority: high | Version: 2.0 | Updated: 2026-05-01 -->

# resolveFrame() — Frame Error Handling With `<pre>`

**Symptom** (historical, v1): `[createFrame] Failed to parse rmx-data script` in browser console when returning HTML error content.

**Evolution**: In v1, returning HTML from `resolveFrame` could corrupt `rmx-data` JSON under certain conditions. The initial workaround was returning an empty string. In v2, the framework's `resolveFrameHtml()` properly handles frame content, and returning a `<pre>` tag provides visible error feedback without breaking hydration.

## Current Pattern

```typescript
// ✅ CORRECT (v2) - Return HTML error for visibility
async function resolveFrame(router, request, src) {
  // ...
  let res = await router.fetch(new Request(url, { headers }))
  if (!res.ok) {
    return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
  }
  return res.body ?? res.text()
}
```

## Error Response Matrix

| Return Value | Behavior |
|-------------|----------|
| `''` (empty string, v1 workaround) | Frame shows fallback, no visible error — hard to debug |
| `<pre>Frame error: 404 Not Found</pre>` (v2) | Visible error in frame slot, preserves hydration |

## Key Rule

Always return `<pre>Frame error: ${status} ${statusText}</pre>` on non-ok frame responses. The `<pre>` tag provides a visible, debuggable error in the frame slot.

## Affected Files

- `bookstore/app/utils/render.tsx` — Uses `<pre>` pattern
- `my_app/app/utils/render.tsx` — Uses `<pre>` pattern

## See Also

- `guides/render-utilities.md` — Full render utility patterns
- `guides/frame-resolution.md` — resolveFrame in depth
