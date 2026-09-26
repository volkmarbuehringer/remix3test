# Remix 3 Entrance, Exit, and Layout Animation

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — "Entrance and exit animations" (L47–108) and "Layout animations" (L110–166).

**Extracted:** 2026-09-26

**Context:** A node enters or leaves, or a keyed list reorders/expands and should animate.

## Problem

No skill indexes `remix/ui/animation`; the presence and layout mixins are guide-only. The app also has its own reduced-motion wrapper that a generic answer would miss.

## Solution

- Import from `remix/ui/animation` and compose the mixins into the `mix` array alongside `css()`, `on()`, and `ref()`.
- `animateEntrance(config)` animates a host node when it is inserted. `animateExit(config)` keeps a removed node in the DOM until its exit animation finishes, so it can animate out instead of vanishing.
- Pass `true` for the default opacity animation or `false` to disable a mixin without changing the surrounding array. `animateEntrance({ initial: false })` skips the first insertion for a key but still animates later insertions. If a keyed element returns before its exit finishes, Remix reclaims that DOM node and animates it back toward its rendered styles.
- Keep `key`s stable when toggling related elements or reordering a list: the key is how the runtime knows which node is entering, exiting, or being replaced.
- `animateLayout(config)` measures a host node before and after a render and animates the visual delta — sorted lists, expanding cards, and layout-shift elements. `key` is not optional in lists. Size projects by default; pass `size: false` when scaling contents would look wrong.

**This app's seams:**

- `app/utils/motion.ts` exports `entrance(config)` that returns `false` when `matchMedia('(prefers-reduced-motion: reduce)').matches`, else the config. Server-rendered page modules apply motion as `animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))` (about fifteen admin/client pages do this). Reuse `entrance()` rather than adding another gate.
- `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into an `animateEntrance` config; `app/assets/entry.tsx` uses `spring('snappy')` imperatively.
- These mixins run on server-rendered markup, not only inside a `clientEntry` — the app's page components apply them directly.

## When to Use

- A conditionally rendered node should fade/slide in or out.
- A keyed list reorders or an element moves because layout changed.
- You are toggling presence and need the removed node to stay until it finishes animating.

## Reference

- `node_modules/remix/guides/07-animation.md` L47–166
- `node_modules/remix/src/ui/animation/README.md`
- `app/utils/motion.ts`, `app/assets/error-card.browser.tsx`
