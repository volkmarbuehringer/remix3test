<!-- Context: development/remix3/errors/frame-reload-crash | Priority: high | Version: 1.0 | Updated: 2026-05-06 -->

# Error: Frame Reload Crash on Embedded Frames

**Symptom**: Calling `handle.frames.top.reload()` or triggering a frame reload on an embedded frame crashes with:
```
DOMException: Cannot have more than one Element child of a Document
```

## Root Cause: Full Document Reload on Embedded Frames

When `reload()` is called, Remix's Frame runtime (`frame.js`) checks `isFullDocumentHtml()` on the rendered content:

```javascript
// frame.js ~line 120-146
if (container.root instanceof Document && isFullDocumentHtml(htmlContent)) {
  // Full document reload path — uses diffNodes on document.head and document.body
  diffNodes([container.doc.head], [parsed.head], ...)
  diffNodes([container.doc.body], [parsed.body], ...)
}
```

**The problem**:
1. `renderToStream()` (used by `renderFragment()`) ALWAYS outputs full HTML documents:
   ```html
   <!DOCTYPE html><html><head>...</head><body>...</body></html>
   ```

2. `isFullDocumentHtml()` returns `true` for this content:
   ```javascript
   function isFullDocumentHtml(trimmed) {
     return /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
   }
   ```

3. For **embedded frames**, `container.root` is an Element (e.g., `<div>`), NOT a Document
   - The condition `container.root instanceof Document` is `false`
   - But if the code somehow reaches the full document path, or during hydration...

4. The actual crash occurs when the full HTML document (with `<html>`, `<head>`, `<body>`) gets parsed and inserted into an embedded frame's root element — creating multiple top-level elements where the Document expects only one

## When This Happens

| Scenario | Result |
|----------|--------|
| `handle.frames.top.reload()` on top-level frame | ✅ Works (frame IS the document) |
| `handle.frames.top.reload()` on embedded frame | ❌ Crashes with DOMException |
| Initial hydration of embedded frame with full HTML | ❌ Can crash during `hydrateInitial()` |
| Pagination/filter reload on embedded frame | ❌ Crashes if using `reload()` |

## Solution

**For embedded frames**, do NOT use `handle.frames.top.reload()`. Instead, use manual fetch + innerHTML swap:

```typescript
// ❌ DON'T: Causes crash on embedded frames
handle.frames.top.reload()

// ✅ DO: Manual fetch pattern
function reloadEmbeddedFrame(url, frameElementId) {
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      // Parse and extract just the content, not the full HTML document
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let container = document.getElementById(frameElementId)
      if (container) {
        // Extract body content or specific element
        let newContent = doc.querySelector('main') || doc.body
        container.innerHTML = newContent.innerHTML
      }
    })
}
```

## Prevention

- Always identify if a frame is top-level (`document`) or embedded (`div`, `section`, etc.)
- Top-level frames: safe to use `handle.frames.top.reload()`
- Embedded frames: use fetch + innerHTML, or restructure to use fragment responses (not full HTML documents)

## Related
- `errors/fragment-navigates-top-frame.md` — Same DOMException from missing `rmx-target` on sub-frame links
- `ui/concepts/frame-reload-paths.md` — Full explanation of reload paths
- `ui/guides/handle-api.md` — Handle API with frame methods warning
- `ui/concepts/component-model.md` — Component model with embedded frame constraints
- `errors/frame-programmatic-navigation.md` — Similar frame navigation issues

## Codebase References
- Remix Frame runtime: `@remix-run/ui/dist/runtime/frame.js` — `reload()` (~line 120), `isFullDocumentHtml()` (~line 838), `hydrateInitial()` (~line 179)
- Remix server rendering: `@remix-run/ui/dist/server/render.js` — `renderToStream()`, `renderFragment()`
