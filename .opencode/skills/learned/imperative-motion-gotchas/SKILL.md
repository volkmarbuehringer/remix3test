---
name: imperative-motion-gotchas
description: "Use when writing element.animate() (WAAPI) animations, transitionend-driven removal, or testing components whose DOM removal is deferred by an exit animation — CSS-level overrides and async teardowns silently break imperative animation paths"
metadata:
  origin: auto-extracted
---

# Imperative Motion: CSS Overrides Don't Reach WAAPI or Inline Transitions

**Extracted:** 2026-10-17
**Context:** Web UIs mixing CSS transitions, WAAPI animations, and reduced-motion support.

## Problem

Three failure modes recur together when a UI mixes CSS state handling with imperative motion, and each fails silently:

1. **WAAPI ignores CSS reduced-motion overrides.** A global `@media (prefers-reduced-motion: reduce) { transition: none !important; ... }` neutralizes stylesheet transitions (and, by `!important`, inline *CSS* ones) — but `element.animate()` runs regardless. Users with reduced motion still get imperative movement.
2. **Stylesheet `!important` beats inline transitions.** `element.style.transition` is non-important inline style; a stylesheet's `transition: none !important` wins → the transition never runs → `transitionend` never fires → any `transitionend`-based cleanup leaks the node forever.
3. **Deferred/async removal races one-shot snapshots.** When DOM removal waits for an async teardown, the teardown's animation may be *created after* your code samples `document.getAnimations()`; awaiting that snapshot's `finished` promises does not mean the node is gone (observed: 1 running animation at t=0, 2 at t≈100ms).

## Solution

- Gate every imperative animation on the media query itself:

  ```ts
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  node.animate(keyframes, options)
  ```

- Never rely on `transitionend` alone for cleanup; pair it with a timeout fallback:

  ```ts
  let done = false
  const finish = () => {
    if (!done) {
      done = true
      el.remove()
    }
  }
  el.addEventListener('transitionend', finish, { once: true })
  setTimeout(finish, 300)
  ```

- In tests, poll for the observable DOM state instead of awaiting a snapshot:

  ```ts
  for (let i = 0; i < 200; i++) {
    if (!document.querySelector('[data-dialog]')) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('removal never happened')
  ```

## When to Use

- Adding `element.animate()` to a component that also ships a reduced-motion CSS guard.
- Driving removal/cleanup from `transitionend` where stylesheets can override transitions with `!important`.
- Writing browser tests for components whose exit animations defer DOM removal.

## Project Cross-References

- Remix-specific recordings of these facts (with app file paths): `.opencode/skills/learned/remix3-styling/references/remix3-animation/` (`reduced-motion.md`, `motion-values.md`, `presence-and-layout.md`)
- Live reference implementations: `app/ui/toast.ts` (transitionend + fallback), `app/ui/appointment-grid.browser.tsx` (WAAPI reduced-motion gate), `app/ui/confirm-delete.test.browser.tsx` (polling test)
