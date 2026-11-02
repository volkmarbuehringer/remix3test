# Remix 3 Entrance, Exit, and Layout Animation

**Source:** installed guide `node_modules/remix/guides/07-animation.md` — §"Entrance and exit animations" and §"Layout animations".

**Extracted:** 2026-09-26

**Context:** A node enters or leaves, or a keyed list reorders/expands and should animate.

## Problem

No skill indexes `@remix-run/ui/animation`; the presence and layout mixins are guide-only. The app also has its own reduced-motion wrapper that a generic answer would miss.

## Solution

- Import from `@remix-run/ui/animation` and compose the mixins into the `mix` array alongside `css()`, `on()`, and `ref()`. For the `animateEntrance`/`animateExit`/`animateLayout` API — `initial: false`, disable-with-`false`, keyed reclamation, `size: false` — use the guide (§"Entrance and exit animations", §"Layout animations"); the deltas below are what it cannot know.
- Keep `key`s stable when toggling related elements or reordering a list: the key is how the runtime knows which node is entering, exiting, or being replaced.

**App delta (2026-10-17, tested): exit-teardown timing in browser tests.** The `animateExit` teardown is *created asynchronously*: `prepareMixinRemoval` runs teardowns through `Promise.resolve().then(...)`, so a single `document.getAnimations()` snapshot taken right after a close-click races the teardown and misses the animation (observed: 1 running animation at t=0, 2 at t≈100ms). In `remix test --type browser`, poll for DOM removal instead:

```ts
async function waitDialogGone() {
  for (let i = 0; i < 200; i++) {
    if (!dialog()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('dialog did not close (exit animation never finished)')
}
```

The runtime removes the node itself once the teardown settles (`reconcile.ts` `remove()` → `performHostNodeRemoval`), so no manual cleanup is needed. Live reference: `app/ui/confirm-delete.browser.tsx` (overlay+dialog entrance/exit with keys `confirm-dialog`/`confirm-card`) and its test's `waitDialogGone()`.

**This app's seams:**

- `app/utils/motion.ts` re-exports `prefersReducedMotion()` from `@remix-run/ui/animation` and exports `entrance(config)` / `exit(config)` that return `false` when it reports reduced motion, else the config. Server-rendered page modules apply motion as `animateEntrance(entrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 }))` (about fifteen admin/client pages do this). Reuse these helpers rather than adding another gate.
- `app/assets/error-card.browser.tsx` spreads `spring('smooth')` into an `animateEntrance` config; `app/assets/entry.tsx` uses `spring('snappy')` imperatively.
- These mixins run on server-rendered markup, not only inside a `clientEntry` — the app's page components apply them directly.

## When to Use

- A conditionally rendered node should fade/slide in or out.
- A keyed list reorders or an element moves because layout changed.
- You are toggling presence and need the removed node to stay until it finishes animating.

## Reference

- `node_modules/remix/guides/07-animation.md` §"Entrance and exit animations", §"Layout animations"
- `node_modules/.pnpm/@remix-run+ui@*/node_modules/@remix-run/ui/src/animation/README.md`
- `app/utils/motion.ts`, `app/assets/error-card.browser.tsx`, `app/ui/confirm-delete.browser.tsx`
