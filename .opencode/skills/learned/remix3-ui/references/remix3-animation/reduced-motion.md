# Remix 3 Reduced-Motion Behavior

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — §"CSS-first visual states" and §"Reduced-motion behavior".

**Extracted:** 2026-09-26

**Context:** Adding motion, or auditing an app for `prefers-reduced-motion` handling.

## Problem

No skill covers reduced motion; the only `matchMedia` reference is a test stub. The app also has a shared helper that must be used instead of new ad-hoc checks.

## Solution

- **CSS boundary first — and in this app it is global.** `app/ui/document.tsx` ships a shell-level guard: under `@media (prefers-reduced-motion: reduce)` it sets `transition: none !important` on `body` **and** on `*, *::before, *::after`, plus `animation-duration: 0.01ms !important` (so `animationend` listeners still fire). Component-level CSS transitions therefore need **no** per-component media query — `app/ui/scaffold-home-page.tsx` keeps an older scoped kill-switch, but new components should not re-gate.
- **JS boundary second.** For JavaScript-driven motion, check the same media query before starting work. **Caveat:** the CSS guard does not stop WAAPI (`element.animate()`) — see § Imperative Motion and Teardown below (live example: `app/ui/appointment-grid.browser.tsx` `startSettleAnimation`).
- **Use the app helpers.** `app/utils/motion.ts` re-exports the vendor `prefersReducedMotion()` (from `@remix-run/ui/animation`) and wraps it as `entrance(config)` / `exit(config)` — the wrappers return `false` under reduced motion (which disables the mixin, removing the node immediately) and otherwise the config. Wrap every `animateEntrance`/`animateExit` config: `animateEntrance(entrance({...}))`, `animateExit(exit({...}))` (see `app/ui/confirm-delete.browser.tsx`).
- **Inline transitions lose to the global guard.** The stylesheet `!important` beats `element.style.transition`, so inline-transition code (e.g. `app/ui/toast.ts`) gets no `transitionend` under reduced motion and needs a timeout fallback (see § Imperative Motion and Teardown below).
- **Reduced motion is not "no feedback."** Prefer shorter fades, instant layout changes, or a non-motion state change when movement is not essential.

## Imperative Motion and Teardown

_(folded from the former `imperative-motion-gotchas` skill, 2026-10-24)_

Three failure modes recur together when JS-driven motion coexists with the shell's CSS guard, and each fails silently:

1. **WAAPI ignores the CSS guard.** `element.animate()` runs regardless of `@media (prefers-reduced-motion: reduce) { transition: none !important }`, so users with reduced motion still get imperative movement.
2. **Stylesheet `!important` beats inline transitions.** `element.style.transition` is non-important inline style; the shell's `transition: none !important` wins, the transition never runs, and any `transitionend`-driven cleanup leaks the node forever.
3. **Deferred removal races one-shot snapshots.** Exit teardowns are created asynchronously (`prepareMixinRemoval` → `Promise.resolve().then(...)`), so a `document.getAnimations()` snapshot taken right after a close-click misses an animation that starts ~100ms later. Poll the observable DOM state instead (see `presence-and-layout.md`).

Rules:

- Gate every imperative animation on the media query itself (use the app helper, which re-exports the vendor one):

  ```ts
  if (prefersReducedMotion()) return
  node.animate(keyframes, options)
  ```

- Never rely on `transitionend` alone; pair it with a timeout fallback so reduced motion and non-transitioning nodes still clean up:

  ```ts
  let removed = false
  let finish = () => {
    if (removed) return
    removed = true
    el.remove()
  }
  el.addEventListener('transitionend', finish, { once: true })
  setTimeout(finish, 300)
  ```

- In browser tests, poll for the observable DOM state rather than awaiting one snapshot (snippet and rationale in `presence-and-layout.md`, `waitDialogGone()`).

Live references: `app/ui/toast.ts` (transitionend + fallback, with the reduced-motion rationale in-code), `app/ui/appointment-grid.browser.tsx` (`startSettleAnimation` gates WAAPI on `prefersReducedMotion()`), and `app/ui/confirm-delete.test.browser.tsx` (`waitDialogGone()` polls for removal).

## When to Use

- Adding any animation, transition, or spring and needing to respect the user's motion preference.
- Auditing a page for a missing `@media (prefers-reduced-motion)` or `matchMedia` gate.
- A new component animates but the app's `entrance()`/`exit()` helpers were not applied.
- Writing `transitionend`-driven code or an imperative WAAPI animation (both need explicit reduced-motion handling).
- A `transitionend`-based cleanup leaks a node, or an exit-animation browser test flakes.

## Reference

- `node_modules/remix/guides/07-animation.md` §"CSS-first visual states", §"Reduced-motion behavior"
- `app/utils/motion.ts`, `app/ui/document.tsx`, `app/ui/scaffold-home-page.tsx`
- `app/ui/toast.ts` (transitionend + timeout fallback), `app/ui/appointment-grid.browser.tsx` (`startSettleAnimation`), `app/ui/confirm-delete.test.browser.tsx` (`waitDialogGone`)
