<!-- Context: frames/errors/resolve-frame-not-stripping-html | Priority: high | Version: 2.0 | Updated: 2026-05-01 -->

# resolveFrame() HTML Wrapper Stripping — Now Handled by Framework

**Symptom** (historical): Frame content showed duplicate HTML structure or nested document tags.

**Evolution**: In v1, `resolveFrame` needed to manually strip HTML wrappers (doctype, `<html>`, `<head>`, `<body>`) from frame responses. In v2, `resolveFrameHtml()` in the framework calls `stripDoctypeMarkup()` internally, making manual stripping unnecessary.

## Historical (v1) Fix

```typescript
// ✅ v1 FIX - Manual stripping in resolveFrame
function stripHtmlWrapper(html: string): string {
  let stripped = html.replace(/<!DOCTYPE[^>]*>/i, '')
  stripped = stripped.replace(/<\/?html[^>]*>/gi, '')
  stripped = stripped.replace(/<head[\s\S]*?<\/head>/gi, '')
  stripped = stripped.replace(/<\/?body[^>]*>/gi, '')
  return stripped.trim()
}
```

## Current (v2) Pattern — No Manual Stripping

```typescript
// ✅ v2 - resolveFrameHtml() handles stripping internally
async function resolveFrame(router, request, src) {
  let res = await router.fetch(new Request(url, { headers }))
  if (!res.ok) {
    return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
  }
  return res.body ?? res.text()
  // No stripHtmlWrapper() call needed — framework handles it
}
```

## What Changed

| Version | Stripping Responsibility |
|---------|-------------------------|
| v1 | Manual `stripHtmlWrapper()` in each `resolveFrame` implementation |
| v2 | Framework's `resolveFrameHtml()` calls `stripDoctypeMarkup()` internally |

## Affected Files

- `bookstore/app/utils/render.tsx` — No manual stripping (v2)
- `my_app/app/utils/render.tsx` — No manual stripping (v2)

## Key Rule

Do NOT manually strip HTML wrappers in `resolveFrame`. The framework handles this automatically. Just return the raw response body or error HTML.

## See Also

- `errors/render-fragment-calls-render.md` — renderFragment pattern evolution
- `guides/render-utilities.md` — Full render utility guide
