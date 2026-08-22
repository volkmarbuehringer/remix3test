---
name: remix3-queuetask-over-raf
description: "In Remix 3 Frames, prefer handle.queueTask() over requestAnimationFrame for DOM ops that must run after a re-render (focus, scroll, measure); keep ref callbacks for self-focus-on-mount"
origin: manual
---

# Prefer `handle.queueTask()` over `requestAnimationFrame` for post-update DOM ops

**Captured:** 2026-08-04
**Context:** A Frame clientEntry (`app/ui/appointment-grid.browser.tsx`) used `requestAnimationFrame`
to focus an input after `handle.update()`. `queueTask` is the vendor-blessed, abortable replacement.

## Rule

When a DOM operation must run **after the DOM reflects a `handle.update()`** — focusing a freshly
revealed input, `scrollIntoView`, scrolling an ancestor, or `getBoundingClientRect` measurement —
use `handle.queueTask(() => { ... })` **not** `requestAnimationFrame`.

```typescript
// ❌ Don't: rAF timing is a guess; it is NOT aborted on re-render and can steal focus
handle.update()
requestAnimationFrame(() => draftInput?.focus())

// ✅ Do: queueTask runs after the DOM changed from this update and is aborted on the next render
handle.update()
handle.queueTask(() => {
  draftInput?.focus()
})
```

## Why `queueTask`, not `requestAnimationFrame`

- `queueTask` is documented by the vendor specifically for "focusing elements, scrolling, or
  measuring dimensions after conditional rendering" (see Authority below). `rAF` is a paint-timing
  primitive that says nothing about whether the Frame's DOM mutation has flushed.
- `queueTask` is **abortable on re-render**: rapid `draft → cancel` in `appointment-grid` previously
  let the `rAF` callback fire and steal focus onto a now-removed input. With `queueTask` the task is
  cancelled when the component re-renders.

## `ref` callback stays valid for self-focus-on-mount

If the element focuses *itself* the moment it mounts, a `ref` callback is the cleaner idiom and needs
no `queueTask`:

```typescript
<input mix={[ ref((el) => { if (el) { el.focus(); el.select() } }) ]} />
```

This is NOT the same as the rAF anti-pattern and should not be "fixed" into `queueTask`.

## Where `queueTask` does NOT apply (avoid scope creep)

`queueTask` attaches to a Frame **render**. It cannot be used where there is no `handle.update()`:

- **Imperative DOM insertion** — `document.createElement('input')` + `cell.appendChild(input)` then
  `input.focus()` (e.g. `client-grid-inline-edit`, `list-name-edit`). The element is inserted
  synchronously; focus right after `appendChild` is correct. `queueTask` has no render to attach to.
- **Imperative class toggles** — `drawer.classList.toggle(...)` then `closeBtn.focus()`
  (`nav-toggle`). No Frame render; synchronous focus is correct.

## Authority

- Vendor: `~/remix/packages/ui/AGENTS.md` — "Focus and Scroll Management" section (~L1644-1745):
  *"Use `handle.queueTask()` in event handlers for DOM operations that need to happen after the DOM
  has changed from the next update. This is the pattern for operations like focusing elements,
  scrolling, or measuring dimensions after conditional rendering."* The modal and scroll examples
  there are the canonical forms.
- Vendor `queueTask` reference: same file ~L198-277 (event-handler usage) and ~L1899-1950 (reactive
  data loading in the render function).

## First application

Retired the only two `requestAnimationFrame` focus sites in the repo
(`app/ui/appointment-grid.browser.tsx:583` `startDraft`, `:641` `startEdit`) in favor of `queueTask`.
The `renameInputs.get(appt.id)` lookup inside `startEdit` remains valid because ref callbacks run
during commit, before `queueTask`.
