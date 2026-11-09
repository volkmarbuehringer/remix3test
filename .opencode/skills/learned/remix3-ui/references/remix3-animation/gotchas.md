# Animation Gotchas (motion values, presence, reduced motion)

**Source:** consolidated from `motion-values`, `presence-and-layout`, `reduced-motion` (installed guide `node_modules/remix/guides/07-animation.md`)

**Extracted:** 2026-09-26; app deltas through 2026-10-24
**Validated:** 2026-11-09 against preview release `v0.20261109.33851-main-092c4d60` / source `092c4d60` (#12220: per-property `transition`, synchronous `animateExit()` start)
**Context:** Springs/tweens, entrance/exit/layout mixins, and `prefers-reduced-motion` in this app.

## Motion values: springs, tweens, easing

- `spring()` returns an **iterator decorated for CSS transitions and Web Animations**. Use it as a CSS value, **spread into animation options** (`{ ...spring('snappy') }`), or iterate it for custom JS.
- `spring.transition(property, name)` produces a CSS transition for one property (e.g. `transition: spring.transition('transform', 'bouncy')`).
- `tween({ from, to, duration, curve })` returns a value loop: call `next()` to start and `next(timestamp)` per frame, reading `{ value, done }`. `easings` supplies curves (`easings.easeOut`). Use it for canvas, counters, or non-CSS values; prefer CSS transitions and animation mixins for ordinary UI.
- **Interruption is the default path.** Event handlers receive abort signals, and animation mixins cancel or replace in-flight work. For custom imperative animation, keep the current `Animation` in setup scope and `cancel()` it before starting the next. CSS transitions are interruptible too — changing the target mid-transition animates from the current visual state.

**App deltas:**

- **Drag-release settle** (`app/ui/appointment-grid.browser.tsx`): on drop, `startSettleAnimation(blockId)` runs `node.animate([...], { ...spring('snappy', { velocity }) })`. Velocity comes from `draggedBlockOffset` samples (`recordDragVelocity`, ≥8ms apart), normalized per the guide (`velocity × 1000 / distance`, clamped ±20, along the larger-distance axis). If a refresh rebuilds the node mid-animation, the block appears in place — graceful degradation.
- **WAAPI ignores the CSS reduced-motion guard** — imperative animations must check `prefersReducedMotion()` themselves (see below).
- **Stylesheet `!important` beats inline transitions.** The shell's `transition: none !important` overrides `element.style.transition`, so a component that sets its own inline transition (e.g. `app/ui/toast.ts`) gets `transitionend` *never* under reduced motion. Anything driven by `transitionend` needs a timeout fallback.
- **This app's seams:** `app/ui/mixins/card-lift.ts` (`cardLift`) is a spreadable style object with a spring-timed transition for transform/box-shadow/border-color, hover lift, and press-back; `app/assets/entry.tsx` `fadeOutBody()` awaits `document.body.animate([...], { ...spring('snappy') }).finished`; `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into `animateEntrance`.

## Entrance, exit, and layout animation

Import from `@remix-run/ui/animation` and compose the mixins into `mix` alongside `css()`, `on()`, and `ref()`. For `animateEntrance`/`animateExit`/`animateLayout` (`initial: false`, disable with `false`, keyed reclamation, `size: false`), use guide §"Entrance and exit animations" / §"Layout animations". Keep `key`s stable when toggling related elements or reordering — the key is how the runtime knows which node is entering, exiting, or being replaced.

**Per-property timing (`transition`, #12220).** `animateEntrance()`/`animateExit()` accept `transition: { [property]: { duration?, easing?, delay?, composite? } }`; each override inherits the shared config, and `duration: 0` applies that property immediately (used to take an exiting node out of normal flow before `animateLayout()` measures). This is also how to run opacity on a shorter tween while transform keeps the spring:

```tsx
mix={animateExit({
  opacity: 0,
  transform: 'scale(0.97) translateY(4px)',
  ...spring('snappy'),
  transition: { opacity: { duration: 120, easing: 'ease-out' } },
})}
```

**Exit start vs. teardown timing in browser tests.** Since #12220 (preview release `v0.20261109.33851-main-092c4d60` / source `092c4d60`), `animateExit()` starts its WAAPI animations **synchronously inside the `beforeRemove` dispatch**, so `document.getAnimations()` immediately after a close-click already includes the exit animations — a single snapshot is now enough to *observe* them. The persisted teardown (`waitForFinish`) is still scheduled through `Promise.resolve().then(...)`, and the runtime removes the node only after it settles, so a removal assertion must still **poll for DOM removal**:

```ts
async function waitDialogGone() {
  for (let i = 0; i < 200; i++) {
    if (!dialog()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('dialog did not close (exit animation never finished)')
}
```

The runtime removes the node once teardown settles (`reconcile.ts` `remove()` → `performHostNodeRemoval`), so no manual cleanup is needed.

**App seams:**

- `app/utils/motion.ts` re-exports `prefersReducedMotion()` from `@remix-run/ui/animation` and exports `entrance(config)` / `exit(config)` that return `false` under reduced motion. Server-rendered pages apply `animateEntrance(entrance({...}))` (~15 admin/client pages).
- `app/ui/confirm-delete.browser.tsx` is the only `animateExit` site. Its dialog entrance/exit runs `opacity` on a 120 ms ease-out while `transform` keeps `spring('snappy')` via `transition`; `app/ui/confirm-delete.test.browser.tsx` asserts the exit animations exist synchronously after close, then polls for removal.
- `app/assets/error-card.browser.tsx` uses `spring('smooth')` in `animateEntrance` with the same 120 ms opacity override; `app/assets/entry.tsx` uses `spring('snappy')` imperatively.
- These mixins run on server-rendered markup, not only inside a `clientEntry`.
- `app/ui/mixins/panel-entrance.ts` (`panelEntrance`) uses the shell's `app-panel-enter` keyframes for server panels; `animateEntrance` is `ssr: false` and must not be applied to plain server components.

## Reduced motion

**CSS boundary first — global in this app.** `app/ui/document.tsx` ships a shell-level guard: under `@media (prefers-reduced-motion: reduce)` it sets `transition: none !important` on `body` **and** `*, *::before, *::after`, plus `animation-duration: 0.01ms !important` (so `animationend` still fires). Component-level CSS transitions need no per-component media query; do not re-gate new components. `app/ui/scaffold-home-page.tsx` keeps an older scoped kill-switch.

**JS boundary second.** For JS-driven motion, check the same query first. The CSS guard does **not** stop WAAPI (`element.animate()`).

**Use the app helpers.** `app/utils/motion.ts` wraps the vendor `prefersReducedMotion()` as `entrance`/`exit`; wrap every `animateEntrance`/`animateExit` config. Inline transitions lose to the global `!important` guard and need a timeout fallback. Reduced motion is not "no feedback" — prefer shorter fades, instant layout changes, or a non-motion state change.

**Three silent failure modes when JS motion coexists with the CSS guard:**

1. **WAAPI ignores the CSS guard** — gate it yourself:
   ```ts
   if (prefersReducedMotion()) return
   node.animate(keyframes, options)
   ```
2. **Stylesheet `!important` beats inline transitions** — a `transitionend`-driven cleanup never fires and leaks the node forever. Pair `transitionend` with a timeout:
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
3. **Deferred removal races one-shot snapshots** — poll the observable DOM state (`waitDialogGone()` above).

Live references: `app/ui/toast.ts` (transitionend + fallback), `app/ui/appointment-grid.browser.tsx` (`startSettleAnimation`), `app/ui/confirm-delete.browser.tsx` (per-property exit timing), `app/ui/confirm-delete.test.browser.tsx` (`waitDialogGone` + synchronous exit-start assertion).

## When to Use

- You need spring/tween/easing timing for CSS, WAAPI, or a JS value loop.
- A node enters/exits or a keyed list reorders and should animate.
- Adding or auditing `prefers-reduced-motion` handling.
- A `transitionend` cleanup leaks a node, or an exit-animation browser test flakes.

## Reference

- `node_modules/remix/guides/07-animation.md` — §"Springs, tweens, and easing", §"Interruptible interactions", §"Entrance and exit animations", §"Layout animations", §"CSS-first visual states", §"Reduced-motion behavior"
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/README.md` — per-property `transition` section
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/animate-mixins.ts` — `transition` type at `:20` and the `beforeRemove` handler at `:477` at source `092c4d60`
- `app/utils/motion.ts`, `app/ui/document.tsx`, `app/ui/mixins/card-lift.ts`, `app/ui/appointment-grid.browser.tsx`, `app/ui/confirm-delete.browser.tsx`
