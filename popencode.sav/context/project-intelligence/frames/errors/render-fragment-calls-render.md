<!-- Context: frames/errors/render-fragment-calls-render | Priority: high | Version: 2.0 | Updated: 2026-05-01 -->

# renderFragment() Now Calls render()

**Symptom** (v1): Fragment responses included full HTML document wrapper, corrupting frame hydration.

**Context**: This was fixed in v1 by making `renderFragment()` independent. In v2, the framework evolved — `resolveFrameHtml()` now calls `stripDoctypeMarkup()` internally, stripping document wrappers from frame responses automatically.

## Current Pattern

```typescript
// ✅ CORRECT (v2) - renderFragment delegates to render()
function renderFragment(node: RemixNode, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }
  return render(node, { ...init, headers })
}
```

`renderFragment()` calls `render()` and adds `Cache-Control: no-store`. The framework handles document wrapper stripping internally via `resolveFrameHtml()` → `stripDoctypeMarkup()`.

## Why This Works Now

| Layer | Responsibility |
|-------|---------------|
| `createHtmlResponse` | Adds `<!DOCTYPE html>` + Content-Type header |
| `resolveFrameHtml()` | Strips wrappers from frame content via `stripDoctypeMarkup()` |
| `renderFragment` | Only adds Cache-Control: no-store, delegates to `render()` |

## Affected Files

- `bookstore/app/utils/render.tsx` — Uses delegation pattern (v2)
- `my_app/app/utils/render.tsx` — Inline render, no separate fragment fn yet

## Key Rule

`renderFragment()` SHOULD call `render()`. Only add `Cache-Control: no-store`. The framework handles the rest.

## See Also

- `errors/resolve-frame-not-stripping-html.md` — Why manual stripping is no longer needed
- `guides/render-utilities.md` — Full render utility patterns
