# Remix 3 Reduced-Motion Behavior

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — "CSS-first visual states" (L6–40) and "Reduced-motion behavior" (L302–333).

**Extracted:** 2026-09-26

**Context:** Adding motion, or auditing an app for `prefers-reduced-motion` handling.

## Problem

No skill covers reduced motion; the only `matchMedia` reference is a test stub. The app also has a shared helper that must be used instead of new ad-hoc checks.

## Solution

- **CSS boundary first.** Put `@media (prefers-reduced-motion: reduce)` inside `css(...)` and neutralize transitions/transforms there. It works before JavaScript loads, applies to server-rendered frames, and covers static transitions. The app does this in `app/ui/document.tsx` (`body { transition: none !important }`) and `app/ui/scaffold-home-page.tsx`.
- **JS boundary second.** For JavaScript-driven motion, check the same media query before starting work: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- **Use the app helper.** `app/utils/motion.ts` exports `prefersReducedMotion()` and `entrance(config)`, which returns `false` under reduced motion and otherwise the config. Every entrance in the app is wrapped with `entrance(...)`; reuse it rather than adding another check. `app/assets/error-card.browser.tsx` shows it composed with a spring: `animateEntrance(entrance({ ..., ...spring('smooth') }))`.
- **Reduced motion is not "no feedback."** Prefer shorter fades, instant layout changes, or a non-motion state change when movement is not essential.

## When to Use

- Adding any animation, transition, or spring and needing to respect the user's motion preference.
- Auditing a page for a missing `@media (prefers-reduced-motion)` or `matchMedia` gate.
- A new component animates but the app's `entrance()` helper was not applied.

## Reference

- `node_modules/remix/guides/07-animation.md` L6–40, L302–333
- `app/utils/motion.ts`, `app/ui/document.tsx`, `app/ui/scaffold-home-page.tsx`
