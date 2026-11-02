# Delete Confirmation via Event Delegation

## What This Covers

Adding a confirmation step to server-rendered delete forms. Read this when a delete form has no built-in confirmation, when `onclick`/`onsubmit` or the `on` mixin fails, or when a `submit` listener never fires under frame navigation. The current implementation uses an in-app `<dialog>`; the same capture-phase interception also backs the native `confirm()` fallback.

## Problem

Server-rendered delete forms (`<form method="POST">` with a DELETE override) have no built-in confirmation. You need to add one, but:

1. **`onclick`/`onsubmit` attributes** fail TypeScript — they're not valid props in Remix 3's JSX types
2. **`on` mixin** silently fails on server-rendered components (only works inside `clientEntry`)
3. **Per-component clientEntry** requires converting each form into a separate clientEntry component with its own props, action URL, and hidden inputs — lots of boilerplate
4. **`submit` event listeners** at the document level are unreliable in Remix 3 frame navigation — the Remix router intercepts the form submission before the native `submit` event fires, silently skipping the confirm dialog

**Root cause:** Remix 3's frame navigation (`data-rmx-target`) intercepts form submissions at the click/pointer level using its own event handling, which can preempt the native `submit` event. A `submit`-phase listener may never fire.

## Solution: capture-phase click interception

Use a **single shared `clientEntry`** with a **capture-phase `click` listener** that intercepts clicks on submit buttons inside `[data-confirm]` forms _before_ Remix's router intercepts them. Always `preventDefault()`/`stopPropagation()`, stash the pending form and submitter, and re-submit from the dialog's accept button.

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

Design invariants:

- **Capture phase** (`{ capture: true }`) — the listener fires before Remix's bubble-phase frame-navigation handler.
- **`requestSubmit(submitter)`, never `submit()`** — `submit()` skips the `submit` event and the frame runtime, turning the in-grid DELETE into a full page load.
- **Always intercept** — never let the first click through while a dialog is pending.
- **`data-confirm` on the `<form>`** — the attribute lives on the form element, not the button, so it survives button restructuring.
- **Single instance per page** — one component at the grid/section level handles all delete forms there.
- **Native modal** — render `role="alertdialog"`/`aria-modal="true"` on a native `<dialog>` and call `showModal()` (details below).
- **Focus restore** — focus the danger button on open; restore the previously focused element when the dialog is removed.

Current implementation: `app/ui/confirm-delete.browser.tsx`, used by `app/actions/admin/public/admin-uploads-bulk-delete.tsx`. Tests: `admin-uploads-bulk-actions.test.browser.tsx`, `uploads-bulk-delete.test.e2e.ts`.

#### Why not `onclick` / `on` / `submit`

| Approach                                          | Boilerplate                                                    | Reliability                                               | Scalability                      |
| ------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| Per-component clientEntry (`on` mixin)            | High — each form needs its own component with serialized props | Medium — works only if `on` fires before Remix intercepts | Low — N components for N forms   |
| `submit` event listener (bubble phase)            | Low — one listener                                             | Low — may not fire in frame navigation                    | High — one listener handles all  |
| **Capture-phase click delegation** (this pattern) | Low — one component + `data-confirm` attribute                 | High — fires before Remix intercepts                      | High — one component handles all |

#### Pitfall: multiple `<ConfirmDelete />` instances break confirmation

Rendering `<ConfirmDelete />` inside a loop (e.g. inside `.map()`) creates **N instances**, each registering its own `document`-level capture-phase click listener via `ref()`. Clicking any delete button fires **all N listeners** — the user sees N consecutive dialogs. Clicking OK on the first and Cancel on any subsequent one calls `preventDefault()` and blocks form submission.

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

**Test for this bug:** click a delete button and count the dialogs. If you see more than one, you have multiple `<ConfirmDelete />` instances on the page.

## Reusing the dialog from non-click triggers: `requestConfirm`

Context-menu deletes and bulk buttons never click a submit button, so the capture-phase listener cannot see them. Export a cancellation-aware event that any module can raise:

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

`ConfirmDelete` listens for the event, calls `event.preventDefault()` and stores the detail. Callers fall back to native `confirm()` when no dialog is mounted, so unit tests and dialog-less pages keep working:

```ts
if (requestConfirm({ message, onConfirm: submit })) return
if (!confirm(message)) return
submit()
```

Test the imperative path by mounting `<ConfirmDelete />`, calling `requestConfirm(...)`, flushing with `result.act(() => undefined)`, then clicking `[data-confirm-accept]` or `[data-confirm-cancel]` and asserting the callback ran (or did not).

To test the **fallback** path headlessly, a fake `globalThis.document` must implement `dispatchEvent(event)`. Returning `true` and leaving `defaultPrevented` false is what a real `EventTarget` does with no listener mounted, so `requestConfirm` returns false and the caller reaches the stubbed `window.confirm`. A stub with only `getElementById`/`querySelector` throws `document.dispatchEvent is not a function` (seen in `app/ui/row-context-menu.test.ts`, where the styled-dialog commit added the `requestConfirm` call without updating the stub).

## Freezing the confirmed scope for bulk actions

A bulk delete confirms "N rows", but the browser builds the payload from the **live form** at submit time. The shared `ConfirmDelete` uses a native modal `<dialog>` + `showModal()`, so user focus and pointer interaction cannot reach the grid behind it (Tab is contained, the rest of the document is inert, Escape fires `cancel`). The freeze still matters for programmatic changes (scripts, extensions, a buggy AT) and for the native-confirm fallback: re-reading the selection when accepted would delete rows the confirmation never named (observed on `/admin/uploads` before the modal/freeze fix: two confirmed, a third checked behind the dialog, POST carried all three).

Freeze the ids when the dialog is accepted and rewrite the outgoing payload instead of trusting the checkboxes. The reliable seam is the `formdata` event on the form:

```ts
let confirmedIds: number[] | null = null
form.addEventListener('formdata', (event) => {
  if (!confirmedIds) return
  event.formData.delete('ids')
  for (let id of confirmedIds) event.formData.append('ids', String(id))
})
// on accept:
confirmedIds = ids
form.requestSubmit(submit)
```

`formdata` gotchas, verified in Chromium + Firefox at the installed pin (2026-10-24):

- `formdata` fires **after** `requestSubmit()` returns, so removing/restoring checkbox `name` (or `checked`) around the call is racy: Chromium reads the form after the restore and submits the extra row (the same code passed in Firefox).
- Chromium fires `formdata` **more than once** for one frame-intercepted submission (first payload = the selection when the dialog opened, second = the live selection), so rewriting once and clearing the frozen ids on the first event is not enough — rewrite every event while the confirmed ids are set. The next confirmation replaces them.

**Third gotcha: never `requestSubmit()` from inside the `submit` listener.** On a real submission the form is already "firing submission events", so a re-entrant `requestSubmit()` is silently ignored by both Chromium and Firefox — the delete is prevented and never re-issued. (Chromium *does* re-enter for a manually dispatched synthetic event, so a naive browser test can pass there and fail in Firefox; the real engines agree.) Only the async styled-dialog path may cancel and re-submit from a promise continuation. For a synchronous fallback (`window.confirm()` accepted), set the frozen ids and let the original submit continue in the same pass:

```ts
if (confirm(message)) {
  confirmedIds = ids
  deselectIds(ids)
} else {
  event.preventDefault()
}
```

Verified 2026-10-26 at pin `8ae2f755`/`0b35d81` on a real submit click in Chromium and Firefox. Guard: `admin-uploads-bulk-actions.test.browser.tsx` asserts the accepted native path returns `true` from `dispatchEvent` and that the `formdata` rewrite still replaces a stray id.

`app/actions/admin/public/admin-uploads-bulk-delete.tsx` implements the styled-dialog path plus this native fallback. `uploads-bulk-delete.test.e2e.ts` ("deletes exactly the confirmed rows when the selection grows while the dialog is open") now asserts the grid is inert while the dialog is open, then mutates the checkbox programmatically and accepts, proving only the two confirmed rows are gone. `admin-uploads-bulk-actions.test.browser.tsx` mounts the real `ConfirmDelete` and covers both the dialog path and the fallback.

## Native modal dialog details (`ConfirmDelete`)

- Render a native `<dialog>` and call `showModal()` from a `ref` on insert. This gives focus containment, page inertness and Escape/`cancel` handling without a hand-rolled trap.
- Do **not** call `dialog.close()` when dismissing: the `animateExit` mixin retains the node for its exit animation, and `close()` removes `open`, hiding the dialog before the animation. Leave it open until removal.
- Restore focus manually after the retained node disconnects. `close()` on a **disconnected** dialog no longer restores focus (the native "previously focused element" state is gone), so capture `document.activeElement` before `showModal()` and focus it from a `MutationObserver` when the node leaves the DOM.
- Playwright/browser tests: `[data-confirm-dialog]` is the inner card; the native `<dialog>` is `[data-confirm-overlay]` (dispatch `cancel` there, not on the card).
- An open modal makes the rest of the page inert, so e2e tests that need to change background state while the dialog is open must do so programmatically (`page.evaluate(...)`) rather than with `locator.click()/check()`.
