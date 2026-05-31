<!-- Context: development/remix3/ui/concepts/frame-reload-paths | Priority: high | Version: 1.0 | Updated: 2026-05-06 -->

# Concept: Frame Reload Paths

**Core Idea**: Remix's Frame runtime has two reload paths — full document reload (for top-level frames) and fragment reload (for embedded frames). The path is determined by `isFullDocumentHtml()` checking if content starts with `<!DOCTYPE html` or `<html>`.

## Two Reload Paths

### Full Document Reload (top-level frames only)
Located in `frame.js` lines 120-146:
```javascript
if (container.root instanceof Document && isFullDocumentHtml(htmlContent)) {
  // Full document reload path
  diffNodes([container.doc.head], [parsed.head], ...)
  diffNodes([container.doc.body], [parsed.body], ...)
}
```

- Only triggers when `container.root instanceof Document` (frame IS the document)
- Parses HTML with `DOMParser`, extracts `<head>` and `<body>`
- Uses `diffNodes()` to patch document head/body incrementally
- Designed for top-level navigation where the frame represents the entire page

### Fragment Reload (embedded frames)
- Triggers for embedded frames (`container.root` is an Element like `<div>`)
- Also triggers when content is NOT full HTML (fragment updates)
- Patches only the frame's root element contents

## isFullDocumentHtml() Function

Located in `frame.js` (~line 838):
```javascript
function isFullDocumentHtml(trimmed) {
  return /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)
}
```

- Returns `true` if content starts with `<!DOCTYPE html` (case-insensitive) or `<html` followed by whitespace/attributes/`>`
- `renderToStream()` (used by `renderFragment()`) ALWAYS outputs full HTML documents:
  ```html
  <!DOCTYPE html><html><head>...</head><body>...</body></html>
  ```
- This is true regardless of `frameSrc` option in Remix 3

## Top-Level vs Embedded Frames

| Aspect | Top-Level Frame | Embedded Frame |
|--------|----------------|----------------|
| `container.root` | `Document` | `Element` (e.g., `<div>`) |
| Full document reload | ✅ Works correctly | ❌ Crashes (`DOMException`) |
| `handle.frames.top.reload()` | ✅ Use this | ❌ Don't use |
| Safe reload pattern | `handle.frames.top.reload()` | `fetch()` + innerHTML swap |

## Frame Hydration Path

`hydrateInitial()` in `frame.js` (~line 179) also calls `render()` with initial HTML:
- Initial SSR content goes through same `isFullDocumentHtml()` check
- Both pagination reload AND initial hydration can trigger full document reload
- Embedded frames receiving full HTML documents during hydration will also crash

## Safe Pattern for Embedded Frames

```typescript
// ❌ DON'T: handle.frames.top.reload() on embedded frames
// Crashes with: DOMException: Cannot have more than one Element child of a Document

// ✅ DO: Manual fetch + innerHTML swap
function reloadEmbeddedFrame(url, frameElementId) {
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newContent = doc.querySelector('main') || doc.body
      let container = document.getElementById(frameElementId)
      if (container) container.innerHTML = newContent.innerHTML
    })
}
```

## Related
- `ui/guides/handle-api.md` — Handle API with frame methods
- `errors/frame-reload-crash.md` — DOMException crash documentation
- `errors/frame-programmatic-navigation.md` — Frame navigation limitations

## Codebase References
- Remix Frame runtime: `@remix-run/ui/dist/runtime/frame.js` — `reload()`, `hydrateInitial()`, `isFullDocumentHtml()`
- Remix server rendering: `@remix-run/ui/dist/server/render.js` — `renderToStream()`, `renderFragment()`
