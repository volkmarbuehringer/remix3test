# Delete Confirmation via Event Delegation

## What This Covers

Adding a `confirm()` dialog to server-rendered delete forms. Read this when a delete form has no built-in confirmation, when `onclick`/`onsubmit` or the `on` mixin fails, or when a `submit` listener never fires under frame navigation.

## Problem

Server-rendered delete forms (`<form method="POST">` with a DELETE override) have no built-in confirmation. You need to add a `confirm()` dialog, but:

1. **`onclick`/`onsubmit` attributes** fail TypeScript — they're not valid props in Remix 3's JSX types
2. **`on` mixin** silently fails on server-rendered components (only works inside `clientEntry`)
3. **Per-component clientEntry** requires converting each form into a separate clientEntry component with its own props, action URL, and hidden inputs — lots of boilerplate
4. **`submit` event listeners** at the document level are unreliable in Remix 3 frame navigation — the Remix router intercepts the form submission before the native `submit` event fires, silently skipping the confirm dialog

**Root cause:** Remix 3's frame navigation (`data-rmx-target`) intercepts form submissions at the click/pointer level using its own event handling, which can preempt the native `submit` event. A `submit`-phase listener may never fire.

## Solution

Use a **single shared `clientEntry`** with a **capture-phase `click` listener** that intercepts clicks on submit buttons inside `[data-confirm]` forms _before_ Remix's router intercepts them.

#### 1. Create the shared component

```tsx
// app/assets/confirm-delete.tsx
import { clientEntry, css, ref, type Handle } from 'remix/component'

export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            document.addEventListener(
              'click',
              (e) => {
                let target = e.target as HTMLElement
                let btn = target.closest('button[type="submit"]') as HTMLButtonElement | null
                if (!btn) return
                let form = btn.closest('form[data-confirm]') as HTMLFormElement | null
                if (!form) return
                let message = form.getAttribute('data-confirm') || 'Wirklich löschen?'
                if (!confirm(message)) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              },
              { capture: true, signal: handle.signal },
            )
          }),
        ]}
      />
    )
  },
)
```

#### 2. Add to page + attribute to forms

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

#### Key Details

- **Capture phase** (`{ capture: true }`): The listener fires during the capture phase, before Remix's own event handling in the bubble phase. This ensures the confirm dialog appears before any navigation starts.
- **`e.preventDefault()` + `e.stopPropagation()`**: Both are needed. `preventDefault()` cancels the click, `stopPropagation()` prevents Remix's frame navigation handler from firing.
- **`handle.signal`**: The AbortSignal from `clientEntry` auto-cleans up the listener when the component unmounts.
- **`data-confirm` on the `<form>`**: The attribute lives on the form element, not the button, so it survives any button restructuring.
- **Single instance per page**: One `<ConfirmDelete />` at the grid section level handles all delete forms in that section.

#### Pitfall: Multiple `<ConfirmDelete />` Instances Break Confirmation

Rendering `<ConfirmDelete />` inside a loop (e.g., inside `.map()`) creates **N instances**, each registering its own `document`-level capture-phase click listener via `ref()`. Clicking any delete button fires **all N listeners** — the user sees N consecutive `confirm()` dialogs. Clicking OK on the first and Cancel on any subsequent one calls `preventDefault()` and blocks form submission.

```tsx
// ❌ WRONG — N instances, N listeners, N dialogs on one click
{
  items.map((item) => (
    <div key={item.id}>
      <form data-confirm="Löschen?">...</form>
      <ConfirmDelete />
    </div>
  ))
}

// ✅ CORRECT — single instance handles all forms
{
  items.map((item) => (
    <div key={item.id}>
      <form data-confirm="Löschen?">...</form>
    </div>
  ))
}
;<ConfirmDelete />
```

**Root cause:** `clientEntry`'s `ref()` callback runs once per rendered instance during hydration. Unlike React's synthetic event delegation (which deduplicates at the root), each `clientEntry` instance independently calls `document.addEventListener(...)`. Since all listeners share `capture: true` and the same selector logic, they all match the same click target and all fire.

**Test for this bug:** Click a delete button and count the confirmation dialogs. If you see more than one, you have multiple `<ConfirmDelete />` instances on the page.

#### Comparison

| Approach                                          | Boilerplate                                                    | Reliability                                               | Scalability                      |
| ------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| Per-component clientEntry (`on` mixin)            | High — each form needs its own component with serialized props | Medium — works only if `on` fires before Remix intercepts | Low — N components for N forms   |
| `submit` event listener (bubble phase)            | Low — one listener                                             | Low — may not fire in frame navigation                    | High — one listener handles all  |
| **Capture-phase click delegation** (this pattern) | Low — one component + `data-confirm` attribute                 | High — fires before Remix intercepts                      | High — one component handles all |

## Upgrade: in-app dialog instead of `window.confirm`

`window.confirm()` is blocking and unstyled; a product surface should ask with its
own dialog. Keep the capture-phase interception above — only what happens on the
click changes: **always** `preventDefault()`/`stopPropagation()`, stash the pending
form and submitter, and re-submit from the dialog confirm button.

```ts
interface PendingConfirm { message: string; onConfirm: () => void }

// inside the clientEntry setup:
let pending: PendingConfirm | null = null
document.addEventListener("click", (event) => {
  let btn = (event.target as HTMLElement).closest("button[type=submit]") as HTMLButtonElement | null
  if (!btn) return
  let form = btn.closest("form[data-confirm]") as HTMLFormElement | null
  if (!form) return
  event.preventDefault()
  event.stopPropagation()
  pending = {
    message: form.getAttribute("data-confirm") || "Wirklich löschen?",
    // requestSubmit dispatches a submit event, so the frame runtime still
    // performs the DELETE. form.submit() bypasses it (full-page navigation).
    onConfirm: () => form.requestSubmit(btn),
  }
  void handle.update()
}, { capture: true, signal: handle.signal })
```

Deltas versus the native version:

- **`requestSubmit(submitter)`, never `submit()`** — `submit()` skips the `submit`
  event and the frame runtime, turning the in-grid DELETE into a full page load.
- **Always intercept** — never let the first click through while a dialog is pending.
- **Focus and dismiss** — render `role="alertdialog"` with `aria-modal="true"` plus
  `aria-labelledby`/`aria-describedby`; focus the danger button with
  `ref((el) => el?.focus())`; handle `Escape` with `on("keydown")` and backdrop-click
  with `event.target === event.currentTarget`.
- The **one-instance-per-grid** rule above still applies (document-level listeners).

### Reuse from non-click triggers: `requestConfirm`

Context-menu deletes and bulk buttons never click a submit button, so the
capture-phase listener cannot see them. Export a cancellation-aware event that any
module can raise:

```ts
const CONFIRM_EVENT = "app:confirm-request"
export interface ConfirmRequestDetail { message: string; onConfirm: () => void }

export function requestConfirm(detail: ConfirmRequestDetail): boolean {
  if (typeof document === "undefined") return false
  let event = new CustomEvent<ConfirmRequestDetail>(CONFIRM_EVENT, { detail, cancelable: true })
  document.dispatchEvent(event)
  return event.defaultPrevented
}
```

`ConfirmDelete` listens for the event, calls `event.preventDefault()` and stores the
detail. Callers fall back to native `confirm()` when no dialog is mounted, so unit
tests and dialog-less pages keep working:

```ts
if (requestConfirm({ message, onConfirm: submit })) return
if (!confirm(message)) return
submit()
```

Test the imperative path by mounting `<ConfirmDelete />`, calling `requestConfirm(...)`,
flushing with `result.act(() => undefined)`, then clicking `[data-confirm-accept]` or
`[data-confirm-cancel]` and asserting the callback ran (or did not).

To test the **fallback** path headlessly, a fake `globalThis.document` must implement
`dispatchEvent(event)`. Returning `true` and leaving `defaultPrevented` false is what a real
`EventTarget` does with no listener mounted, so `requestConfirm` returns false and the caller
reaches the stubbed `window.confirm`. A stub with only `getElementById`/`querySelector` throws
`document.dispatchEvent is not a function` (seen in `app/ui/row-context-menu.test.ts`, where the
styled-dialog commit added the `requestConfirm` call without updating the stub).
