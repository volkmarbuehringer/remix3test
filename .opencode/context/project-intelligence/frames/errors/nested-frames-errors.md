---
id: frames-nested-issues
title: Nested Frames Errors — /books1 Implementation Issues
category: project-intelligence/frames
type: errors
version: 2.0.0
author: opencode
tags: [frame, nested, render, resolve, books1, error]
description: Issues during nested Frames implementation in /books1, including render.tsx bugs, missing unique names, and security errors.
codebase: bookstore
dependencies: []
---

# Nested Frames Errors — /books1 Implementation Issues

Issues encountered implementing nested Frames in /books1 where each book card renders a full BookCard component.

## Issue 1: Missing Unique Frame Names

**Symptom**: Cart button state from page 1 appears on page 2 at the same DOM position.

**Fix**: Add `name={`cart-button-${book.id}`}` prop to each Frame. Without unique names, frame manager can't distinguish instances, causing state to leak across pagination.

---

## Issue 2: Missing DOCTYPE in render()

**Symptom**: Browser shows "Page is in Quirks Mode" warning.

**v1 Fix**: Prepend `<!DOCTYPE html>\n` via ReadableStream before render output.
**v2**: Use `createHtmlResponse(stream, init)` which handles DOCTYPE prepending automatically.

---

## Issue 3: renderFragment() Calling render()

**Symptom**: Fragment responses include full HTML document wrapper.

**v1 Fix**: Make renderFragment() independent — no doctype or wrapper.
**v2**: renderFragment() delegates to render() with `Cache-Control: no-store`. Framework's `resolveFrameHtml()` strips document wrappers internally.

---

## Issue 4: resolveFrame() Not Stripping HTML Wrappers

**Symptom**: Duplicate HTML structure or nested document tags in frame content.

**v1 Fix**: Add `stripHtmlWrapper()` to extract inner content only.
**v2**: Handled internally by `resolveFrameHtml()` → `stripDoctypeMarkup()`.

---

## Issue 5: resolveFrame() Returning HTML Error Content

**Symptom**: `[createFrame] Failed to parse rmx-data script` — client hydration fails.

**v1 Fix**: Return `''` on error to preserve JSON integrity.
**v2**: Return `<pre>Frame error: ${status} ${statusText}</pre>` for visible error feedback without corrupting hydration data.

---

## Issue 6: Missing x-remix-frame Header

**Symptom**: Frame requests return full page HTML instead of fragment content.

**v1 Fix**: Add `headers.set('x-remix-frame', 'true')` in resolveFrame().
**v2**: No longer needed — framework identifies frame requests internally.

---

## Issue 7: resolveFrame() Not Using ResolveFrameContext

**Symptom**: Nested frames resolve incorrectly relative to parent.

**v1 Fix**: Add `ResolveFrameContext` parameter, use `context.currentFrameSrc` as base.
**v2**: Removed from API — use `new URL(src, request.url)` for all frame resolution.

---

## Issue 8: resolveClientEntry Missing from renderFragment

**Symptom**: Client entries in fragments don't hydrate.

**Fix**: Add `resolveClientEntry: (src) => resolveClientEntry(router, src)` to renderToStream options.

---

## Issue 9: Invalid URL — frameSrc Empty in Fragments

**Symptom**: `TypeError: Invalid URL` when rendering fragments.

**Fix**: Pass `frameSrc: request.url` to renderToStream in fragment context.

---

## Issue 10: Security Errors — file:/// URIs

**Symptom**: `SecurityError: Blocked loading module from origin` in browser.

**Fix**: Use `new URL(src, window.location.origin)` instead of `new URL(src, 'file://localhost')`.

---

## Issue 11: Stale Props After Pagination (Cart Button)

**Symptom**: Cart buttons show correct values on initial load, wrong values after pagination.

**Fix**: Remove `<Frame>` wrapper and render `CartButton` directly as a clientEntry. See [stale-props-after-pagination.md](./stale-props-after-pagination.md).

---

## Issue 12: Client Entry Local State Reset

**Symptom**: Clicking Add/Remove Cart button has no visible effect.

**Fix**: Track `lastPropInCart` and only sync when the prop changes. See [client-entry-state-reset.md](./client-entry-state-reset.md).

---

## v2 Evolution

Issues 2–7 reflect v1 patterns resolved in v2:

| Issue | v1 | v2 |
|-------|----|----|
| DOCTYPE | Prepend in render() | `createHtmlResponse()` |
| renderFragment | Make independent | Delegate to render() |
| HTML stripping | stripHtmlWrapper() | Framework handles |
| Error content | Return `''` | Return `<pre>` tag |
| x-remix-frame | Add header | Not needed |
| ResolveFrameContext | Add param | Removed from API |

---

## Summary of Required Fixes

| # | Issue | Key Fix |
|---|-------|---------|
| 1 | Missing names | Add unique `name` prop per instance |
| 2-7 | render.tsx bugs | See v2 patterns above |
| 8 | Missing resolveClientEntry | Add to renderFragment options |
| 9 | Empty frameSrc | Pass `frameSrc: request.url` |
| 10 | file:/// URIs | Use window.location.origin |
| 11 | Stale props | Render CartButton directly |
| 12 | State reset | Track lastPropInCart |

## Related Errors

- `development/remix3/errors/frame-rmx-data-parse.md` — JSON parsing from HTML errors

## See Also

- [nested-frames.md](../guides/nested-frames.md) — Nested Frames architecture guide
- [render-utilities.md](../../../development/remix3/guides/render-utilities.md) — Render utilities reference
- [frame-resolution.md](../../../development/remix3/ui/guides/frame-resolution.md) — Frame resolution guide
- [stale-props-after-pagination.md](./stale-props-after-pagination.md) — Stale props after pagination
- [client-entry-state-reset.md](./client-entry-state-reset.md) — Local state reset by props
