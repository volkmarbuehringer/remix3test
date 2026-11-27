# Animation Gotchas (motion values, presence, reduced motion)

**Source:** consolidated from `motion-values`, `presence-and-layout`, `reduced-motion` (installed guide `node_modules/remix/guides/07-animation.md`)

**Extracted:** 2026-09-26; app deltas through 2026-11-24
**Validated:** 2026-11-15 against preview release `v0.20261114.200722-main-3fac48ab` / source `3fac48ab` (#12220: per-property `transition` at `animate-mixins.ts:20`, synchronous `beforeRemove` start at `:477`; guide 07 byte-identical between `848e2fbe` and `3fac48ab`, last content change `ca504176` was demo-only).
**Context:** Springs/tweens, entrance/exit/layout mixins, and `prefers-reduced-motion` in this app.

## Motion values: springs, tweens, easing

- `spring()` returns an **iterator decorated for CSS transitions and Web Animations**. Use it as a CSS value, **spread into animation options** (`{ ...spring('snappy') }`), or iterate it for custom JS.
- `spring.transition(property, name)` produces a CSS transition for one property (e.g. `transition: spring.transition('transform', 'bouncy')`).
- `tween({ from, to, duration, curve })` returns a value loop: call `next()` to start and `next(timestamp)` per frame, reading `{ value, done }`. `easings` supplies curves (`easings.easeOut`). Use it for canvas, counters, or non-CSS values; prefer CSS transitions and animation mixins for ordinary UI.
- **Interruption is the default path.** Event handlers receive abort signals, and animation mixins cancel or replace in-flight work. For custom imperative animation, keep the current `Animation` in setup scope and `cancel()` it before starting the next. CSS transitions are interruptible too — changing the target mid-transition animates from the current visual state.

**App deltas:**

- **Drag-release settle** (`app/ui/appointment-grid.browser.tsx`): on drop, `startSettleAnimation(blockId)` runs `node.animate([...], { ...spring('snappy', { velocity }) })`. Velocity comes from `draggedBlockOffset` samples (`recordDragVelocity`, ≥8ms apart), normalized per the guide (`velocity × 1000 / distance`, clamped ±20, along the larger-distance axis). The in-flight settle is held in setup scope and `cancelSettleAnimation()` runs at `startDrag`/`startResize`/`startEdit`, so a regrabbed block never keeps the old WAAPI transform while the drag writes its own. If a refresh rebuilds the node mid-animation, the block appears in place — graceful degradation.
- **Message clamp FLIP** (`app/ui/message-expand.browser.tsx`): `animateHeightDelta()` measures the current visual height, applies the state change, then cancels the previous `Animation` before measuring the new natural height (a running animation controls `height`, so measuring first would read the old animation). Cleanup is keyed to the current `spanAnimations` entry; a canceled animation's settled `finished` must not clear the replacement's `overflow`/`height`.
- **WAAPI ignores the CSS reduced-motion guard** — imperative animations must check `prefersReducedMotion()` themselves (see below).
- **Stylesheet `!important` beats inline transitions.** The shell's `transition: none !important` overrides `element.style.transition`, so a component that sets its own inline transition gets `transitionend` *never* under reduced motion. Anything driven by `transitionend` needs a timeout fallback. The earlier `app/ui/toast.ts` was that case; the current `app/ui/toast-host.browser.tsx` avoids `transitionend` entirely (CSS transition for the fade, a 300 ms timeout for removal), so reduced motion follows the same path.
- **This app's seams:** `app/ui/mixins/card-lift.ts` (`cardLift`) is a spreadable style object with a spring-timed transition for transform/box-shadow/border-color, hover lift, and press-back; `app/assets/fade-out-body.ts` `fadeOutBody()` (called by `app/assets/entry.tsx`) skips the WAAPI fade under reduced motion and otherwise awaits `body.animate([...], { ...spring('snappy') }).finished`; `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into `animateEntrance`.

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

- `app/utils/motion.ts` re-exports `prefersReducedMotion()` from `@remix-run/ui/animation` and exports `entrance(config)`, which returns `false` under reduced motion. `exit()` was retired with the `confirm-delete` `animateExit` site; add it back only when another `animateExit` site exists. Server-rendered panels cannot use these mixins: `animateEntrance`/`animateExit` are `ssr: false`, so they use `app/ui/mixins/panel-entrance.ts` (`panelEntrance`, the shell's `app-panel-enter` keyframes) instead.
- Only client entries apply the presence mixins: `app/assets/error-card.browser.tsx` (fatal-card entrance). The shell `app/ui/confirm-delete.browser.tsx` is the vendor `@remix-run/ui/dialog`; its surface animates with CSS `data-state` transitions (`opacity` 120 ms ease-out, `transform` a `spring('snappy')` transition) and a reduced-motion opt-out, so it has no `animateExit` call. `app/ui/confirm-delete.test.browser.tsx` still asserts the finite CSS transition runs after close before polling for removal.
- `app/assets/error-card.browser.tsx` uses `spring('smooth')` in `animateEntrance` with the same 120 ms opacity override; `app/assets/entry.tsx` calls `fadeOutBody()` from `app/assets/fade-out-body.ts`, which checks reduced motion before its imperative `spring('snappy')` fade.

**Native `<details>` is not a drop-in for a measured expand control.** Spiked for the `/admin/messages` two-line message clamp on 2026-11-09 and rejected — keep `app/ui/message-expand.browser.tsx`:

- The app floor (Chrome 126 / Safari 18.2) predates every CSS piece the migration needs: `::details-content` is Chrome 131+/Safari 18.4+, and `interpolate-size: allow-keywords` is Chrome 129+ with no Safari implementation, so there is no CSS-only height transition at the floor.
- "Hide the toggle when the text fits" is a measurement, not a style. CSS has no general overflow query: scroll-state container queries (`@container scroll-state(scrollable: bottom)`, the closest candidate) are Chrome 133+ and unsupported in Safari and Firefox, and a closed `<details>` hides its content (`display: none`), so the full text cannot be measured after render either. The entry's `scrollHeight > clientHeight` post-render sweep is what keeps short messages button-free.
- Moving the toggle into `<summary>` while keeping that sweep retains the client entry and changes the ARIA/interaction contract for no deletion win, so the migration was abandoned rather than half-landed. Revisit only if the floor reaches scroll-state queries in every supported engine (or the product accepts an always-visible toggle).

## View Transitions

**Cross-document (full page).** The shared shell (`app/ui/document.tsx`) opts in with `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }`. This needs Chrome 126+ / Safari 18.2+; Firefox ignores the at-rule (no cross-document support as of 2026-11) and navigates normally. Only real document navigations participate — login/logout and links carrying `data-rmx-document`; frame swaps are same-document and never trigger it.

- Persistent chrome is named `app-header` (`app/ui/main-nav.tsx`) and `app-sidebar` (`app/ui/sidebar-layout.tsx`). A `view-transition-name` must be unique per document, so never render two matching shells.
- Browser test: `app/ui/view-transitions.test.e2e.ts`. Playwright `page.goto()` does **not** activate cross-document View Transitions; click a real `data-rmx-document` link and observe `pageswap`/`pagereveal`'s `viewTransition` (write it to `sessionStorage` so it survives the swap). Chromium is the only project that asserts activation; Firefox asserts the frame/no-op path.
- App floor: `app/assets.ts` targets `{ chrome: '126', safari: '18.2' }`, matching both the VT baseline and `linear()` springs (Safari 17.2+); see AGENTS.md § Browser Support Floor.

**Same-document (theme flip).** `app/ui/theme-toggle.browser.tsx` wraps the `data-theme`/storage/cookie update in `document.startViewTransition(update)` after a `typeof … === 'function'` feature check and a `prefersReducedMotion()` guard from `app/utils/motion.ts`. The update callback runs asynchronously (after the old snapshot), so tests either stub `startViewTransition` to record/invoke the callback or await the transition; the fallback must still flip exactly once when `startViewTransition` throws.

**Same-document (lists reorder).** `app/actions/lists/public/lists-view-transition.ts` names the keyed rows (`view-transition-name: list-item-<id>`) only while a reorder is in flight, re-applies the names inside the update callback (a re-created row needs the new-snapshot name), and clears them when `finished` settles. It uses the same support/reduced-motion guards and an instant fallback; a superseded transition must not clear the newer transition's names. Tests: `lists-view-transition.test.browser.tsx` (phase-level stubs plus the real platform `startViewTransition` wrapper; the list reorder needed no e2e server round trip).

## Reduced motion

**CSS boundary first — global in this app.** `app/ui/document.tsx` ships a shell-level guard: under `@media (prefers-reduced-motion: reduce)` it sets `transition: none !important` on `body` **and** `*, *::before, *::after`, plus `animation-duration: 0.01ms !important` (so `animationend` still fires). Component-level CSS transitions need no per-component media query; do not re-gate new components. The landing page's keyframes keep a scoped `animation: none`/`transition: none` guard in `app/ui/home-styles.tsx`.

**JS boundary second.** For JS-driven motion, check the same query first. The CSS guard does **not** stop WAAPI (`element.animate()`) or an explicit `scrollIntoView({ behavior: 'smooth' })`. The app's two smooth-scroll call sites (`app/ui/appointments-new-create.browser.tsx` mobile panel reveal, `app/ui/admin-chatlog-detail.browser.tsx` transcript reveal) switch to `'auto'` under reduced motion.

**Use the app helpers.** `app/utils/motion.ts` wraps the vendor `prefersReducedMotion()` as `entrance`; wrap every `animateEntrance` config (add `exit` when an `animateExit` site exists). Inline transitions lose to the global `!important` guard and need a timeout fallback. Reduced motion is not "no feedback" — prefer shorter fades, instant layout changes, or a non-motion state change.

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

Live references: `app/ui/toast-host.browser.tsx` (timeout-only fade; reduced motion follows the same path), `app/ui/appointment-grid.browser.tsx` (`startSettleAnimation`/`cancelSettleAnimation`), `app/ui/message-expand.browser.tsx` (retarget-before-measure + cleanup guard), `app/assets/fade-out-body.ts` (WAAPI reduced-motion gate), `app/ui/appointments-new-create.browser.tsx` / `app/ui/admin-chatlog-detail.browser.tsx` (smooth-scroll gate), `app/ui/confirm-delete.browser.tsx` / `app/ui/confirm-delete.test.browser.tsx` (vendor-dialog CSS `data-state` timing + `waitDialogGone`).

## When to Use

- You need spring/tween/easing timing for CSS, WAAPI, or a JS value loop.
- A node enters/exits or a keyed list reorders and should animate.
- Adding or auditing `prefers-reduced-motion` handling.
- A `transitionend` cleanup leaks a node, or an exit-animation browser test flakes.

## Reference

- `node_modules/remix/guides/07-animation.md` — §"Springs, tweens, and easing", §"Interruptible interactions", §"Entrance and exit animations", §"Layout animations", §"CSS-first visual states", §"Reduced-motion behavior"
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/README.md` — per-property `transition` section
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/animate-mixins.ts` — `transition` type at `:20` and the `beforeRemove` handler at `:477` at source `56522c2e`
- `app/utils/motion.ts`, `app/ui/document.tsx`, `app/ui/mixins/panel-entrance.ts`, `app/ui/mixins/card-lift.ts`, `app/ui/appointment-grid.browser.tsx`, `app/ui/message-expand.browser.tsx`, `app/assets/fade-out-body.ts`, `app/ui/confirm-delete.browser.tsx`
