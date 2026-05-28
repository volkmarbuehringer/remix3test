<!-- Context: project-intelligence/my_app/errors | Priority: critical | Version: 1.0 | Updated: 2026-05-06 -->

# Error Reference: Embedded Frame Reload Gotcha

**Purpose**: Document the crash scenario when using `handle.frames.top.reload()` in embedded Remix Frame components, including root cause, workaround, and key technical references.

---

## 1. `handle.frames.top.reload()` Crashes Embedded Frames

**Symptom**: `DOMException: Cannot have more than one Element child of a Document` at `diff-dom.js:76` when calling `handle.frames.top.reload()` in an embedded Frame (Frame component inside a page layout).

**Root cause**: `handle.frames.top.reload()` triggers Remix's full document reload path in `frame.js`, which is designed for **top-level frames** (where the Frame is the entire document). The full document reload path is activated when the server response starts with `<html>` or `<!DOCTYPE html` (detected by `isFullDocumentHtml()` in `frame.js`). Embedded Frames exist inside a parent Document that already has an `<html>` element — inserting another `<html>` via full document reload violates the DOM constraint.

**Key technical details**:
- `renderToStream()` (used by `renderFragment()`) always outputs full HTML documents: `<!DOCTYPE html><html><head>...</head><body>...</body></html>`
- `isFullDocumentHtml()` check in `frame.js`: `/^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)`
- Stripping the `<html>` wrapper from the server response does not resolve the crash (the initial hydration path also triggers full document reload)

**Fix**: For embedded Frames, use the `fetchPage()` pattern instead:
1. Manually fetch the target URL with `fetch()`
2. Strip the full HTML wrapper from the response
3. Update the Frame container's innerHTML directly
4. Never use `handle.frames.top.reload()` for embedded Frames

```typescript
// ✅ Embedded Frame update pattern (fetchPage())
function fetchPage(offset: number, sort?: string, order?: string): void {
  let url = new URL('/client/grid', window.location.origin)
  url.searchParams.set('offset', String(offset))
  if (sort) url.searchParams.set('sort', sort)
  if (order) url.searchParams.set('order', order)
  // Fetch, strip HTML wrapper, update container innerHTML
}

// ❌ BROKEN: Triggers full document reload in embedded Frames
handle.frames.top.reload()
```

---

## 📂 Codebase References

- `my_app/app/assets/grid-client.ts` — `fetchPage()` implementation for embedded Frames
- Remix UI runtime: `node_modules/remix/ui/dist/frame.js` — `isFullDocumentHtml()` function (lines ~120-130)
- `my_app/app/actions/render.tsx` — `renderToStream()` output configuration
- `my_app/app/actions/client/grid-page.tsx` — Embedded Frame fragment rendering

## Related

- [Frame Rendering Gotchas](./frame-rendering-gotchas.md) — General Frame rendering issues (response.body, x-remix-frame header)
- [Client Pagination + Sort Guide](../guides/client-pagination-sort.md) — `fetchPage()` usage in client pagination
- [Architecture Concepts](../concepts/architecture.md) — Frame infrastructure overview
