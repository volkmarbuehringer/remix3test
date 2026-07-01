---
name: remix-data-confirm-delete-event-delegation
description: "Use data-confirm + capture-phase click delegation for delete confirmations on server-rendered Remix 3 forms"
user-invocable: false
origin: auto-extracted
---

# Remix 3: Delete Confirmation via Event Delegation

**Extracted:** 2026-06-13
**Context:** Adding delete confirmation dialogs to server-rendered admin grid forms in a Remix 3 app using frame navigation (`rmx-target`).

## Problem

Server-rendered delete forms (`<form method="POST">` with a DELETE override) have no built-in confirmation. You need to add a `confirm()` dialog, but:

1. **`onclick`/`onsubmit` attributes** fail TypeScript — they're not valid props in Remix 3's JSX types
2. **`on` mixin** silently fails on server-rendered components (only works inside `clientEntry`)
3. **Per-component clientEntry** requires converting each form into a separate clientEntry component with its own props, action URL, and hidden inputs — lots of boilerplate
4. **`submit` event listeners** at the document level are unreliable in Remix 3 frame navigation — the Remix router intercepts the form submission before the native `submit` event fires, silently skipping the confirm dialog

## Root Cause

Remix 3's frame navigation (`rmx-target`) intercepts form submissions at the click/pointer level using its own event handling, which can preempt the native `submit` event. A `submit`-phase listener may never fire.

## Solution

Use a **single shared `clientEntry`** with a **capture-phase `click` listener** that intercepts clicks on submit buttons inside `[data-confirm]` forms *before* Remix's router intercepts them.

### 1. Create the shared component

```tsx
// app/assets/confirm-delete.tsx
import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            document.addEventListener('click', (e) => {
              let target = e.target as HTMLElement
              let btn = target.closest(
                'button[type="submit"]',
              ) as HTMLButtonElement | null
              if (!btn) return
              let form = btn.closest(
                'form[data-confirm]',
              ) as HTMLFormElement | null
              if (!form) return
              let message =
                form.getAttribute('data-confirm') || 'Wirklich löschen?'
              if (!confirm(message)) {
                e.preventDefault()
                e.stopPropagation()
              }
            }, { capture: true, signal: handle.signal })
          }),
        ]}
      />
    )
  },
)
```

### 2. Add to page + attribute to forms

```tsx
import { ConfirmDelete } from '../assets/confirm-delete.tsx'

// In the page component, render it once inside the grid wrapper:
<div mix={table.minWidth0}>
  <ConfirmDelete />
  {/* ... table, forms, etc ... */}
</div>

// On each delete form, add the data-confirm attribute:
<RestfulForm
  method="DELETE"
  action="/resources/123"
  data-confirm="Wirklich löschen?"
>
  {/* ... hidden inputs, buttons ... */}
</RestfulForm>
```

### 3. Import + render in any grid page that needs delete confirmation

### Key Details

- **Capture phase** (`{ capture: true }`): The listener fires during the capture phase, before Remix's own event handling in the bubble phase. This ensures the confirm dialog appears before any navigation starts.
- **`e.preventDefault()` + `e.stopPropagation()`**: Both are needed. `preventDefault()` cancels the click, `stopPropagation()` prevents Remix's frame navigation handler from firing.
- **`handle.signal`**: The AbortSignal from `clientEntry` auto-cleans up the listener when the component unmounts.
- **`data-confirm` on the `<form>`**: The attribute lives on the form element, not the button, so it survives any button restructuring.
- **Single instance per page**: One `<ConfirmDelete />` at the grid section level handles all delete forms in that section.

### Pitfall: Multiple `<ConfirmDelete />` Instances Break Confirmation

Rendering `<ConfirmDelete />` inside a loop (e.g., inside `.map()`) creates **N instances**, each registering its own `document`-level capture-phase click listener via `ref()`. Clicking any delete button fires **all N listeners** — the user sees N consecutive `confirm()` dialogs. Clicking OK on the first and Cancel on any subsequent one calls `preventDefault()` and blocks form submission.

```tsx
// ❌ WRONG — N instances, N listeners, N dialogs on one click
{items.map((item) => (
  <div key={item.id}>
    <form data-confirm="Löschen?">...</form>
    <ConfirmDelete />
  </div>
))}

// ✅ CORRECT — single instance handles all forms
{items.map((item) => (
  <div key={item.id}>
    <form data-confirm="Löschen?">...</form>
  </div>
))}
<ConfirmDelete />
```

**Root cause:** `clientEntry`'s `ref()` callback runs once per rendered instance during hydration. Unlike React's synthetic event delegation (which deduplicates at the root), each `clientEntry` instance independently calls `document.addEventListener(...)`. Since all listeners share `capture: true` and the same selector logic, they all match the same click target and all fire.

**Test for this bug:** Click a delete button and count the confirmation dialogs. If you see more than one, you have multiple `<ConfirmDelete />` instances on the page.

## Comparison

| Approach | Boilerplate | Reliability | Scalability |
|----------|-------------|-------------|-------------|
| Per-component clientEntry (`on` mixin) | High — each form needs its own component with serialized props | Medium — works only if `on` fires before Remix intercepts | Low — N components for N forms |
| `submit` event listener (bubble phase) | Low — one listener | Low — may not fire in frame navigation | High — one listener handles all |
| **Capture-phase click delegation** (this pattern) | Low — one component + `data-confirm` attribute | High — fires before Remix intercepts | High — one component handles all |

## When to Use

- Adding `confirm()` dialogs to server-rendered `<form>` elements in Remix 3 admin grids
- Any time you need to intercept form submission before Remix's frame navigation (`rmx-target`) handles it
- When you have multiple delete forms on a single page and want to avoid per-form clientEntry components
- When the simpler `on` mixin approach silently fails and you need a more reliable alternative
