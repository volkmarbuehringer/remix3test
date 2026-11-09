# Native `<dialog>` Drawer and Modal Migration

**Source:** extracted 2026-11-09 from the nav-drawer migration (`app/ui/main-nav.tsx` → `app/ui/layout/nav-toggle.browser.tsx`); app seams re-checked against `app/ui/layout/nav-toggle.browser.tsx`, `app/ui/confirm-delete.browser.tsx`, and their browser tests on 2026-11-09.

**Context:** Replacing a hand-rolled drawer, menu, or modal — `is-open` state, Escape/backdrop listeners, `previousFocus` bookkeeping — with a native `<dialog>` opened by `showModal()`. The platform owns the top layer, background inertness, Escape (`cancel`), focus containment, and focus restore; the app keeps only the page scroll lock and the trigger's `aria-expanded`.

## Problem

A naive migration keeps the old state machine and assumes the platform close is synchronous:

- The entry still mirrors `is-open` on the element and keeps a `previousFocus` variable even though `<dialog>` owns the open state and focus containment.
- `dialog.close()` fires `close` on a **later task**, so a click handler that only cleans up from the `close` event leaves `aria-expanded` and the page scroll lock stale until that task runs.
- `cancel` (Escape) fires **before** the platform closes; `close` fires after.
- Synthetic `keydown`/`cancel` events in browser tests do not run the dialog's default close action.
- Native focus restore targets the element focused before `showModal()`; a re-render can replace that trigger, dropping focus to `<body>` (WCAG 2.4.3).
- A re-render can replace the **open** dialog with a closed one; the old modal is gone and cannot emit `close`, so a scroll lock released only from the event leaks.
- An open top-layer dialog hidden by a breakpoint's `display: none` leaves the page inert with no visible way to close it.
- A modal retained for an exit animation is disconnected before `close()`, so the platform's focus restore no longer runs.

The result is a migration that removes the hand-rolled trap but adds stale state and flaky tests.

## Solution

### Drawer: keep only what the platform does not provide

Working seam: `app/ui/layout/nav-toggle.browser.tsx` (rendered by `app/ui/main-nav.tsx`). The entry adds the page scroll lock and `aria-expanded`; everything else is native. Listeners are delegated by id so a re-render replacing either node needs no rebinding, and `handle.signal` removes them.

```ts
export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(handle: Handle) {
    let unlockScroll: (() => void) | null = null

    function getDrawer(): HTMLDialogElement | null {
      let drawer = document.getElementById('nav-drawer')
      return drawer instanceof HTMLDialogElement ? drawer : null
    }

    function setExpanded(isOpen: boolean) {
      document.getElementById('nav-toggle')?.setAttribute('aria-expanded', String(isOpen))
    }

    function open() {
      let drawer = getDrawer()
      if (!drawer || drawer.open) return
      drawer.showModal()
      setExpanded(true)
      unlockScroll = lockScroll()
      document.getElementById('nav-close')?.focus()
    }

    function cleanup() {
      setExpanded(false)
      unlockScroll?.()
      unlockScroll = null
      // Focus the live node: native restore targets the pre-showModal trigger,
      // which a re-render may replace.
      document.getElementById('nav-toggle')?.focus()
    }

    function close() {
      let drawer = getDrawer()
      if (!drawer?.open) return
      drawer.close()
      // The platform queues `close`; clean up now so a close click unlocks
      // immediately. The dialog-event listener repeats this idempotently.
      cleanup()
    }

    function onDialogEvent(event: Event) {
      if (event.target instanceof Element && event.target.id === 'nav-drawer') cleanup()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (event) => {
          let target = event.target
          if (!(target instanceof Element)) return
          if (target.closest('#nav-toggle')) {
            let drawer = getDrawer()
            if (drawer) drawer.open ? close() : open()
          } else if (target.closest('#nav-drawer')) {
            // Backdrop, close button, and destination links all dismiss.
            close()
          }
        },
        { signal: handle.signal },
      )
      // Neither `cancel` (Escape) nor `close` bubbles, so both are observed in
      // the capture phase. `cancel` runs before the platform closes, so the
      // trigger and scroll lock do not lag; never preventDefault.
      for (let type of ['cancel', 'close'] as const) {
        document.addEventListener(type, onDialogEvent, {
          signal: handle.signal,
          capture: true,
        })
      }
    }

    return () => {
      if (typeof document === 'undefined') return null
      let drawer = getDrawer()
      let btn = document.getElementById('nav-toggle')
      // A re-render can replace the open dialog with a closed one; the old
      // modal cannot emit `close`, so release the lock here.
      if (unlockScroll && !drawer?.open) cleanup()
      if (!drawer || !btn) return null
      if (btn.getAttribute('data-nav-toggle-ready') !== 'true') {
        btn.setAttribute('data-nav-toggle-ready', 'true')
      }
      return null
    }
  },
)
```

Rules:

- **Do not `preventDefault()` on `cancel`** unless you need to veto dismissal. Use it only to release scroll lock/ARIA before the platform closes.
- **Do not rely on the `close` event for immediate state.** Call the same idempotent cleanup from your own `close()` path; the event listener repeats it.
- **Observe `cancel` and `close` in the capture phase** — neither bubbles.
- **Guard the re-render path**: release the scroll lock when the open dialog was replaced by a closed one (`unlockScroll && !drawer?.open`), or the page cannot scroll again until reload.
- **Focus the live trigger in cleanup**, not a captured `previousFocus` node.
- **Mark hydration readiness** with a `data-*-ready` attribute on the trigger; a click before listeners attach is a no-op, and e2e can wait for the marker.

### Modal with an exit animation: own the close path

`app/ui/confirm-delete.browser.tsx` keeps the dialog mounted through `animateExit`, which changes two rules:

- `showModal()` runs from the `ref` on insert (not from state), so the retained node stays open while the exit transition fades it.
- `cancel` is `preventDefault()`ed and routed through the app's own close path, because the platform close would hide the node before the exit animation.
- A `MutationObserver` waits for the retained dialog to be disconnected, then restores focus manually — `close()` on a disconnected dialog no longer restores focus.

Use this shape only when the modal must animate out; the drawer above should let the platform close immediately.

### Keep an open modal visible at hide breakpoints

An open top-layer dialog hidden by `display: none` leaves the page inert with no visible way to close it:

```css
dialog[open] { display: flex; }
@media (min-width: 901px) {
  dialog { display: none !important; }
  dialog[open] { display: flex !important; }
}
```

Or close it from a `matchMedia` change listener.

### Test recipe

Working tests: `app/ui/layout/nav-toggle.test.browser.tsx`, `app/ui/confirm-delete.test.browser.tsx`.

- Assert `dialog.open` **and** `dialog.matches(':modal')` — `open` alone does not prove the top layer.
- Use `dialog.close()` for the platform-initiated path in browser/unit tests; synthetic `keydown` or `dispatchEvent(new Event('cancel'))` does not run the default close.
- Use a real `page.keyboard.press('Escape')` in an e2e test for the platform Escape mapping.
- Poll observable state after a platform close; do not assume the queued `close` event lands in one macrotask (it flakes under load):

```ts
async function waitForUnlock() {
  for (let i = 0; i < 200; i++) {
    if (document.documentElement.style.overflow === '') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('scroll lock did not release')
}
```

- Cover the replaced-trigger case: replace the toggle while open, close, and assert focus lands on the live trigger.
- Cover the replaced-dialog case: replace the open `<dialog>` with a closed one, re-render, and assert the scroll lock released.
- If the scroll lock refcounts on a document-keyed `WeakMap` (`app/utils/scroll-lock.ts`), close through the entry in `afterEach` before removing the fixture; a stale count corrupts the next test's lock.

## When to Use

- Replacing a hand-rolled drawer/menu/modal with `<dialog>` + `showModal()`.
- Escape or backdrop dismissal suddenly needs manual code after the migration.
- `aria-expanded`, scroll lock, or focus restore lags or leaks after close.
- A re-render replaces the trigger or the open dialog and focus/scroll state breaks.
- A modal must animate out, so the app owns the close path.
- Browser tests around close/focus/scroll lock pass locally but flake in the full suite.
