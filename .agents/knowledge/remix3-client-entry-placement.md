---
title: 'Remix 3 clientEntry global behaviors must mount in Document'
tags: [remix3, clientEntry, theme, layout, Document, client-side]
created: 2026-06-01
status: active
---

## Problem

A `clientEntry` component (like `ThemeToggle`) that registers a global event listener (`document.addEventListener`) only works on pages where it is actually mounted. When rendered only inside `<Layout>`, pages that use `<Document>` directly (e.g., standalone landing pages) never mount the component — the event listener is never registered, and the feature silently breaks.

The theme toggle button (`#theme-toggle`) appeared in the HTML on all pages (rendered by the shared `MainNav`), but clicking it did nothing on the home page because the click handler was never attached.

## Solution

Mount global `clientEntry` behaviors in `<Document>` — the root wrapper that every page shares — rather than in `<Layout>`:

```tsx
// app/ui/document.tsx
import { ThemeToggle } from '../assets/theme-toggle.tsx'

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    return (
      <html>
        <head>...</head>
        <body>
          <RMX_01_GLYPHS />
          {children}
          <ThemeToggle /> {/* ← global: mounted on every page */}
        </body>
      </html>
    )
  }
}
```

Remove the duplicate from `<Layout>`:

```tsx
// app/ui/layout.tsx
return (
  <Document title={title}>
    ...
    {/* ❌ Remove <ThemeToggle /> from here — it's in Document now */}
  </Document>
)
```

## Why

- `<Document>` is the single root wrapper for ALL routes, regardless of whether they use `<Layout>`, a sidebar layout, or render standalone content.
- `clientEntry` components register their behavior via module-level state with an `initialized` flag. They only need to mount once — placing them in Document guarantees they mount exactly once per page load.
- The `initialized` flag prevents duplicate listener registration even if the component re-renders.
- This pattern applies to any global behavior: analytics, keyboard shortcuts, connection monitors, etc.
