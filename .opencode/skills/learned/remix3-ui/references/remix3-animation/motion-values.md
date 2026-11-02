# Remix 3 Springs, Tweens, and Interruptible Motion

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — §"Springs, tweens, and easing" and §"Interruptible interactions".

**Extracted:** 2026-09-26

**Context:** You need a motion value (spring/tween/easing), or an imperative animation on a DOM node.

## Problem

`spring()`, `spring.transition()`, `tween()`, and `easings` are not named by any skill. The only existing hint is a warning against `requestAnimationFrame` for post-update DOM work, which is a different problem.

## Solution

- `spring()` returns an **iterator decorated for CSS transitions and Web Animations**. Use it three ways: stringify it in CSS, **spread it into animation options** (`{ ...spring('snappy') }`), or iterate it for custom JavaScript.
- `spring.transition(property, name)` produces a CSS transition value for a specific property (e.g. `transition: spring.transition('transform', 'bouncy')`).
- `tween({ from, to, duration, curve })` returns a value loop: call `next()` to start and `next(timestamp)` per frame, reading `{ value, done }`. `easings` supplies curves such as `easings.easeOut`. Use tween for canvas, counters, or values that are not CSS properties; **prefer CSS transitions and animation mixins for ordinary UI**.
- **Interruption is the default path.** Event handlers receive abort signals, and the animation mixins cancel or replace in-flight work when the DOM changes again. For custom imperative animation in this app, keep the current `Animation` in setup scope and `cancel()` it before starting the next one. CSS transitions are interruptible too — changing the target mid-transition animates from the current visual state.

**App delta (2026-10-17): drag-release settle with a velocity-aware spring.** `app/ui/appointment-grid.browser.tsx` implements the guide's drag-release demo: on drop, `startSettleAnimation(blockId)` runs `node.animate([{ transform: translate(fromX, fromY) }, { transform: 'none' }], { ...spring('snappy', { velocity }) })` — WAAPI overrides the inline transform while playing, and the rendered inline value is already `none`, so the block rests in its slot when the animation ends. Velocity comes from `draggedBlockOffset` samples (`recordDragVelocity`, ≥8ms apart to absorb pointer jitter), normalized per the guide (`velocity × 1000 / distance`, clamped ±20, along the larger-distance axis). If a refresh rebuilds the node mid-animation the block just appears in place — graceful degradation, no cleanup needed. **WAAPI animations are not covered by the CSS `prefers-reduced-motion` guard** — imperative animations must check `prefersReducedMotion()` themselves.

**App delta (2026-10-17): stylesheet `!important` beats inline transitions.** The shell's global reduced-motion rule (`app/ui/document.tsx`: `transition: none !important`) overrides inline `element.style.transition` — a component that sets its own inline transition (e.g. `app/ui/toast.ts`) gets `transitionend` *never* under reduced motion. Anything driven by `transitionend` needs a timeout fallback.

**This app's seams:**

- `app/ui/mixins/card-lift.ts` exports `cardLift`, a plain (spreadable) style object with spring-timed `transition` for transform/box-shadow/border-color, hover lift, and active press-back — spread it as `css({ ...cardBaseCss, ...cardLift, ... })` in interactive cards (see `app/ui/admin-page.tsx`, `app/ui/verwaltung-page.tsx`). Reduced motion is handled by the shell's global rule; do not re-gate per component.
- `app/assets/entry.tsx` `fadeOutBody()` runs `document.body.animate([...], { ...spring('snappy') })` and awaits `animation.finished` — the imperative WAAPI form of spreading a spring into options.
- `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into an `animateEntrance` config (the declarative form).

## When to Use

- You need spring/tween timing for a CSS transition, a WAAPI animation, or a JS value loop.
- You are animating a node imperatively and it can be re-triggered before the previous animation ends.
- You need to decide between CSS/WAAPI and a JavaScript value loop.

## Reference

- `node_modules/remix/guides/07-animation.md` §"Springs, tweens, and easing", §"Interruptible interactions"
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/README.md`
- `app/assets/entry.tsx`, `app/assets/error-card.browser.tsx`, `app/ui/appointment-grid.browser.tsx`, `app/ui/mixins/card-lift.ts`
