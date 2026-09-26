---
name: remix3-animation
description: "Use when adding or debugging motion in a Remix 3 app — entrance/exit presence, layout animation, spring()/tween()/easing values, CSS-first reduced-motion gating, and interruptible imperative animations with remix/ui/animation."
user-invocable: false
origin: learned
---

# Remix 3 Animation

**Extracted:** 2026-09-26

This skill is the **pointer/delta index** for guide `node_modules/remix/guides/07-animation.md` (the canonical motion model). The component primitives it composes with (`clientEntry`, `on`, `ref`, `mix`) are covered by the vendor `remix` skill and `remix3-client-entries`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A node enters/exits, toggles presence, or a keyed list reorders/expands | `references/presence-and-layout.md` |
| Choosing `spring()` vs `spring.transition()` vs `tween()`; imperatively animating a node; interruption | `references/motion-values.md` |
| `prefers-reduced-motion`, gating animation before JS loads, or the app's motion helper | `references/reduced-motion.md` |

## Core Rules

**Presence and layout (`references/presence-and-layout.md`)**

- `animateEntrance(...)` runs on insert; `animateExit(...)` keeps a removed node in the DOM until its exit finishes. Both are mixins, composed into a `mix` array with `css()`/`on()`/`ref()`.
- Pass `true`/`false` to enable/disable without reshaping the array; `animateEntrance({ initial: false })` skips the first insertion for a key; a keyed element that returns before its exit ends is reclaimed and animated back.
- Stable `key`s are required for enter/exit/replace and for `animateLayout(...)` in lists. `animateLayout` measures before/after and animates the delta; size projects by default, `size: false` animates position only.
- The app already gates entrance motion: `app/utils/motion.ts` exports `entrance(config)` returning `false` under reduced motion; server-rendered pages wrap as `animateEntrance(entrance({...}))`. Use that helper; do not add a second gate.

**Motion values (`references/motion-values.md`)**

- `spring()` returns an iterator decorated for CSS and Web Animations: stringify it in CSS, spread it into options (`{ ...spring('snappy') }`), or iterate it. `spring.transition(property, name)` builds a CSS transition value.
- `tween({from,to,duration,curve})` + `next(ts) -> { value, done }` and `easings` are for canvas, counters, and non-CSS values; prefer CSS/WAAPI for ordinary UI.
- Interruption is the default: handler signals abort, mixins cancel/replace in-flight work, and imperative code keeps the current `Animation` in setup scope and `cancel()`s it before restarting.

**Reduced motion (`references/reduced-motion.md`)**

- Respect it at the CSS boundary first (`@media (prefers-reduced-motion: reduce)` inside `css()`), because it works before JS and for server-rendered frames; then check `matchMedia` for JS-driven motion.
- Reduced motion is not "no feedback" — prefer shorter fades, instant layout, or non-motion state changes.

## When to Use

- A node appears/disappears, a list reorders, or a card expands and should animate.
- You need a spring/tween value or an imperative WAAPI animation.
- You are adding motion and must respect reduced-motion and interruption.

## Related Skills

- `remix3-client-entries` — `clientEntry`/`on`/`ref`/runtime lifecycle
- `remix3-css-and-layout` — `css()`, `@layer rmx`, layout mechanics
- `remix3-rendering-ui` — composing mixins and building blocks
