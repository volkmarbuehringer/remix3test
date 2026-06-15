---
name: remix3-select-default-value
description: "Remix 3 template system doesn't support React's defaultValue on select — use selected on option instead"
user-invocable: false
origin: auto-extracted
---

# Remix 3 `<select>` Needs `selected` on `<option>`, Not `defaultValue`

**Extracted:** 2026-06-15
**Context:** Building a settings form with a `<select>` dropdown for page size where the current value should be preselected.

## Problem

React's `defaultValue` attribute on `<select>` does not work in Remix 3's template system. The attribute is passed through to the DOM verbatim, where it has no effect — no `<option>` gets `selected`, and the browser defaults to the first option regardless of the value.

Wrong (React convention, silently broken in Remix 3):
```tsx
<select name="pageSize" defaultValue={15}>
  <option value={10}>10</option>
  <option value={15}>15</option>
  <option value={20}>20</option>
</select>
<!-- Always shows "10" — defaultValue has no effect -->
```

## Solution

Use the HTML-native `selected` attribute on individual `<option>` elements instead:

```tsx
<select name="pageSize">
  <option value={10} selected={pageSize === 10}>10</option>
  <option value={15} selected={pageSize === 15}>15</option>
  <option value={20} selected={pageSize === 20}>20</option>
</select>
```

Remix 3's template engine correctly handles the boolean `selected` attribute: `selected={true}` adds it, `selected={false}` omits it — same as `aria-invalid`, `required`, `checked`, and similar boolean attributes elsewhere in the codebase.

## Why

Remix 3 uses its own JSX-like template runtime (`remix/ui`) that compiles to HTML string output. React's `defaultValue` is a special prop handled by React's reconciler during hydration — it compares the value against child `<option>` values and adds the `selected` attribute server-side. Remix 3's template system doesn't have this special handling; it passes `defaultValue` through as an HTML attribute on `<select>`, which is non-standard and ignored by browsers.

## When to Use

- Preselecting a value in a `<select>` dropdown in any Remix 3 component
- Migrating form code from React projects to Remix 3
- Any time a dropdown always shows the first option instead of the intended value
