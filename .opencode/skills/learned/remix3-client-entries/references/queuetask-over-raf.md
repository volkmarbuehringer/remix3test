# Prefer `handle.queueTask()` over `requestAnimationFrame` for post-update DOM ops

**Source:** `remix3-queuetask-over-raf`

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

- `queueTask` is documented by the vendor as running "a task during the commit after the next
  update", for when "DOM measurement or another update must happen as part of that flush" (see
  Authority below). `rAF` is a paint-timing primitive that says nothing about whether the Frame's
  DOM mutation has flushed.
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

- Vendor guide: `node_modules/remix/guides/05-interactivity.md` — *"If rendering discovers work
  that should run after the commit, schedule that work with `handle.queueTask()`"* (`:234-235`) and
  *"`handle.queueTask(task)` runs a task during the commit after the next update. Use it when DOM
  measurement or another update must happen as part of that flush"* (`:279-280`); the
  `scrollIntoView` example at `:286-288` is the canonical form. The installed `Handle` type
  documents the same contract at `@remix-run/ui/src/runtime/component.ts:33-51`.
- Since #11795, `handle.update()`'s own docs say to call it from an event handler or `handle.queueTask()`
  — this skill is now the vendor-blessed remedy for the phase-guard throws (see `remix3-frame-cliententry`).

## First application

Retired the only two `requestAnimationFrame` focus sites in the repo
(`app/ui/appointment-grid.browser.tsx:583` `startDraft`, `:641` `startEdit`) in favor of `queueTask`.
The `renameInputs.get(appt.id)` lookup inside `startEdit` remains valid because ref callbacks run
during commit, before `queueTask`.
