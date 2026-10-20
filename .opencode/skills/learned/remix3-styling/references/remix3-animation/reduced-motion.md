# Remix 3 Reduced-Motion Behavior

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — §"CSS-first visual states" and §"Reduced-motion behavior".

**Extracted:** 2026-09-26

**Context:** Adding motion, or auditing an app for `prefers-reduced-motion` handling.

## Problem

No skill covers reduced motion; the only `matchMedia` reference is a test stub. The app also has a shared helper that must be used instead of new ad-hoc checks.

## Solution

- **CSS boundary first — and in this app it is global.** `app/ui/document.tsx` ships a shell-level guard: under `@media (prefers-reduced-motion: reduce)` it sets `transition: none !important` on `body` **and** on `*, *::before, *::after`, plus `animation-duration: 0.01ms !important` (so `animationend` listeners still fire). Component-level CSS transitions therefore need **no** per-component media query — `app/ui/scaffold-home-page.tsx` keeps an older scoped kill-switch, but new components should not re-gate.
- **JS boundary second.** For JavaScript-driven motion, check the same media query before starting work. **Caveat:** the CSS guard does not stop WAAPI (`element.animate()`) — imperative animations must call `prefersReducedMotion()` themselves (see `app/ui/appointment-grid.browser.tsx` `startSettleAnimation`).
- **Use the app helpers.** `app/utils/motion.ts` re-exports the vendor `prefersReducedMotion()` (from `@remix-run/ui/animation`) and wraps it as `entrance(config)` / `exit(config)` — the wrappers return `false` under reduced motion (which disables the mixin, removing the node immediately) and otherwise the config. Wrap every `animateEntrance`/`animateExit` config: `animateEntrance(entrance({...}))`, `animateExit(exit({...}))` (see `app/ui/confirm-delete.browser.tsx`).
- **Inline transitions lose to the global guard.** The stylesheet `!important` beats `element.style.transition`, so inline-transition code (e.g. `app/ui/toast.ts`) gets no `transitionend` under reduced motion and needs a timeout fallback.
- **Reduced motion is not "no feedback."** Prefer shorter fades, instant layout changes, or a non-motion state change when movement is not essential.

## When to Use

- Adding any animation, transition, or spring and needing to respect the user's motion preference.
- Auditing a page for a missing `@media (prefers-reduced-motion)` or `matchMedia` gate.
- A new component animates but the app's `entrance()`/`exit()` helpers were not applied.
- Writing `transitionend`-driven code or an imperative WAAPI animation (both need explicit reduced-motion handling).

## Reference

- `node_modules/remix/guides/07-animation.md` §"CSS-first visual states", §"Reduced-motion behavior"
- `app/utils/motion.ts`, `app/ui/document.tsx`, `app/ui/scaffold-home-page.tsx`
