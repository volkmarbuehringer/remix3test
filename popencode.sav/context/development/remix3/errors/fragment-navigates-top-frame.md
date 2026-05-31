<!-- Context: development/remix3/errors/fragment-navigates-top-frame | Priority: high | Version: 1.0 | Updated: 2026-05-18 -->

# Error: Fragment Navigates Top Frame (Missing `rmx-target`)

**Symptom**: Clicking a link inside a sub-Frame crashes with "Unexpected Error / Something went wrong" card and this console error:
```
Node.insertBefore: Cannot have more than one Element child of a Document
```

## Root Cause

A link inside a sub-Frame has no `rmx-target` attribute. When clicked, the navigation intercept defaults to the top-level Document frame, which then loads fragment HTML — causing the DOMException during diff.

### Call Chain

1. **Click** `<a href="/admin/fragments/user-detail/101">View details</a>` (no `rmx-target`)
2. **Navigation intercept** (`navigation.ts::startNavigationListener`) catches the click
3. **`getSourceElementNavigationState()`** finds no `rmx-target` → `target = undefined`
4. **Frame resolution**: No `rmx-target` → defaults to `topFrame` (the Document-level frame from `createFrame(document, ...)`)
5. **`topFrame.reload()`** fetches the fragment URL
6. **Server response**: The fragment endpoint returns HTML that includes:
   - `<!DOCTYPE html>` (prepended by `createHtmlResponse()`)
   - `<head>` with styles (prepended by `finalizeHtml()` when `flushKind !== 'document'`)
   - `<div>` with actual content
7. **Top frame `render()`**:
   - `stripDoctypeMarkup()` strips DOCTYPE
   - Content parsed as DocumentFragment (since `isFullDocumentReload` is false — flushKind was `'fragment'`)
8. **`diffNodes()`** (`diff-dom.ts`) with:
   - `curr = [<!DOCTYPE html>, <html>]` — the Document's actual children
   - `next = [<head>, <div>]` — the parsed fragment children
   - `parent = document` (because `curr[0].parentNode` is the Document)
9. **`diffNode()`** compares DocumentType (`<!DOCTYPE html>`) vs Element (`<head>`):
   - Type mismatch → `parent.insertBefore(<head>, <!DOCTYPE html>)`
   - **❌ Throws**: A `Document` can only have one Element child

10. **Error propagation**: `scheduler.dispatchError()` → `rootTarget.dispatchEvent()` → `app.addEventListener('error')` → renders the error card

## When This Happens

| Scenario | Result |
|----------|--------|
| Sub-Frame link with `rmx-target="frameName"` | ✅ Works — navigates the named frame |
| Sub-Frame link with no `rmx-target` | ❌ Crashes — defaults to top frame, loads fragment HTML into Document |
| Top-level frame link with no `rmx-target` | ✅ Works — the top frame IS the Document |
| `<details>/<summary>` disclosure (no navigation) | ✅ Works — no navigation intercept triggered |
| Server-rendered sub-frames (SSR via `buildFrameSegment`) | ✅ Works — bounded by comment markers, parent is a regular element |

## Why This Only Affects Dynamically Navigated Top Frames

- **Server-rendered sub-frames**: Content is bounded by `<!-- rmx:f:id -->` / `<!-- /rmx:f -->` comment markers. The parent is always a regular Element (e.g., `<div>`). `diffNodes` runs against an Element, not the Document — no DOMException.
- **Dynamically navigated top frame**: The top-level Document frame's parent IS the Document itself. Fragment HTML (with `<head>` wrapper) gets diffed against the Document's children, causing the error.

**Key insight**: The `<head>` wrapper that `finalizeHtml()` adds to fragments is safe for sub-frames but deadly for the top frame.

## Solutions

### Option A: Add `rmx-target` to the link (preferred for navigation)

```html
<!-- ❌ Broken: defaults to top frame -->
<a href="/admin/fragments/user-detail/101">View details</a>

<!-- ✅ Fixed: targets the correct sub-frame -->
<a href="/admin/fragments/user-detail/101" rmx-target="admin-content">View details</a>
```

### Option B: Use a non-navigating disclosure pattern (for toggling visibility)

```tsx
// ✅ No navigation at all — just native HTML disclosure
<details>
  <summary>View details</summary>
  <Frame src="/admin/fragments/user-detail/101" fallback="Loading..." />
</details>
```

`<details>/<summary>` requires zero JavaScript and avoids the navigation intercept entirely.

### Option C: `rmx-document` for intentional full-page navigations

```html
<!-- ✅ Explicit intent: load as full document (not fragment) -->
<a href="/admin/user-detail/101" rmx-document>View details</a>
```

## Prevention

- **Every `<a>` inside a `<Frame>`** must have either `rmx-target="frameName"` or `rmx-document`
- **No `rmx-target` on a link inside a Frame is always a bug** — the navigation intercept will default to `topFrame`
- For disclosure/show-hide patterns, prefer `<details>/<summary>` over links
- For manual fetch patterns, use a `<button>` with a click handler, not an `<a>`

## Related

- `errors/frame-reload-crash.md` — Same DOMException from `handle.frames.top.reload()` on embedded frames
- `errors/frame-programmatic-navigation.md` — Navigation API limitations with Frames
- `guides/frame-navigation-patterns.md` — Frame navigation patterns including rmx-target rules
- `ui/guides/frame-resolution.md` — resolveFrame mechanics
- `ui/concepts/frame-reload-paths.md` — Reload path explanations

## Codebase References

- `newapp/app/ui/admin-fragments/recent-activity-fragment.tsx` — Contained the broken link (fixed to `<details>/<summary>`)
- `newapp/app/assets/entry.tsx` — `resolveFrameResponse()`, global error handler rendering error card
- `@remix-run/ui/src/runtime/frame.ts` — `createFrame(document, ...)` creates the top-level Document frame
- `@remix-run/ui/src/runtime/navigation.ts` — `startNavigationListener()` intercepts clicks, `getSourceElementNavigationState()` determines target
- `@remix-run/ui/src/runtime/diff-dom.ts` — `diffNodes()` where the Document insertBefore failure occurs
- `@remix-run/ui/src/runtime/reconcile.ts` — `insertFrame()` for dynamically created frames
- `@remix-run/ui/src/server/stream.ts` — `finalizeHtml()` prepends `<head>` to fragment HTML
- `@remix-run/response/src/lib/html.ts` — `createHtmlResponse()` prepends `<!DOCTYPE html>`
