# Remix 3 Springs, Tweens, and Interruptible Motion

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — "Springs, tweens, and easing" (L168–251) and "Interruptible interactions" (L253–300).

**Extracted:** 2026-09-26

**Context:** You need a motion value (spring/tween/easing), or an imperative animation on a DOM node.

## Problem

`spring()`, `spring.transition()`, `tween()`, and `easings` are not named by any skill. The only existing hint is a warning against `requestAnimationFrame` for post-update DOM work, which is a different problem.

## Solution

- `spring()` returns an **iterator decorated for CSS transitions and Web Animations**. Use it three ways: stringify it in CSS, **spread it into animation options** (`{ ...spring('snappy') }`), or iterate it for custom JavaScript.
- `spring.transition(property, name)` produces a CSS transition value for a specific property (e.g. `transition: spring.transition('transform', 'bouncy')`).
- `tween({ from, to, duration, curve })` returns a value loop: call `next()` to start and `next(timestamp)` per frame, reading `{ value, done }`. `easings` supplies curves such as `easings.easeOut`. Use tween for canvas, counters, or values that are not CSS properties; **prefer CSS transitions and animation mixins for ordinary UI**.
- **Interruption is the default path.** Event handlers receive abort signals, and the animation mixins cancel or replace in-flight work when the DOM changes again. For custom imperative animation, keep the current `Animation` in setup scope and `cancel()` it before starting the next one. CSS transitions are interruptible too — changing the target mid-transition animates from the current visual state.

**This app's seams:**

- `app/assets/entry.tsx` `fadeOutBody()` runs `document.body.animate([...], { ...spring('snappy') })` and awaits `animation.finished` — the imperative WAAPI form of spreading a spring into options.
- `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into an `animateEntrance` config (the declarative form).

## When to Use

- You need spring/tween timing for a CSS transition, a WAAPI animation, or a JS value loop.
- You are animating a node imperatively and it can be re-triggered before the previous animation ends.
- You need to decide between CSS/WAAPI and a JavaScript value loop.

## Reference

- `node_modules/remix/guides/07-animation.md` L168–300
- `node_modules/remix/src/ui/animation/README.md`
- `app/assets/entry.tsx`, `app/assets/error-card.browser.tsx`
