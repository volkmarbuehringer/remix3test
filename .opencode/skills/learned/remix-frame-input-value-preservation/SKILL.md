---
name: remix-frame-input-value-preservation
description: 'Remix Frame DOM reconciliation preserves input.value during reloads — defaultValue never applied'
user-invocable: false
origin: auto-extracted
---

# Remix Frame Input Value Preservation

**Extracted:** 2026-07-20
**Context:** When a Remix Frame reloads with new server-rendered HTML containing `<input value="...">`, the `defaultValue` is silently ignored. The input keeps its previous value (or stays empty).

## Problem

Remix Frames use DOM diffing (`diff-dom.js`) instead of full replacement when updating content on `frame.reload()`. When an `<input>` element is matched by tag and position, `diffElementAttributes` is called. For the `value` attribute, `shouldPreserveLiveAttribute` checks:

```javascript
if (name === 'value') {
  if (current instanceof HTMLInputElement &&
      next instanceof HTMLInputElement &&
      shouldPreserveInputValue(current)) {
    return current.value !== next.value;  // true → SKIP the update
  }
}
```

When `current.value` differs from `next.value` (e.g. empty string vs "fritz"), the check returns `true`, meaning **preserve the current value**. `setAttribute('value')` is skipped entirely. The server-rendered `defaultValue` is never applied.

This affects:
- Filter/search inputs with `defaultValue={filterParam}` on Frame-reloaded pages
- Any form input that relies on `defaultValue` inside a Remix Frame
- GET form submissions with `rmx-target` that navigate the frame

## Solution

Set the input's `.value` property **directly after the frame reload completes**, bypassing the DOM diff:

```typescript
function restoreFilterValue(url: string) {
  let filterValue = new URL(url, window.location.origin).searchParams.get('filter') ?? ''
  for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
    input.value = filterValue
  }
}

// In handleNavigate:
frame.src = href
frame.reload().then(
  () => restoreFilterValue(href),
  (err) => handleError(err),
)
```

For values that should persist across navigations (e.g. the user's last search), store the value and restore it when no URL parameter is present:

```typescript
let lastFilterValue: string = ''

function restoreFilterValue(url: string) {
  let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
  if (filterValue !== null) {
    lastFilterValue = filterValue
  }
  let value = filterValue ?? lastFilterValue
  for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
    input.value = value
  }
}
```

For the frame's `handleFrameFormSubmit` GET handler, apply the same pattern after `frame.reload()`.

## When to Use

- Server-rendered form inputs with `defaultValue` inside a Remix `<Frame>` don't show the expected value after navigation
- Filter/search inputs are empty after a Frame reload even though the URL has the correct query parameter
- The frame content updates but `<input>` elements keep their old values
