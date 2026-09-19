# remix3 CSS: hover reveal of child/nested elements

**Source:** `remix3-css-hover-reveal`

**Extracted:** 2026-08-24
**Context:** Styling a sidebar/row whose action buttons (rename, delete, etc.) should appear only while the row is hovered or keyboard-focused, in a Remix 3 `remix/ui` app.

## Problem
In the `remix/ui` `css()` runtime (this app's nightly `remix`), a reveal rule that selects a **descendant/child only while a hovered ancestor** is applied silently generates *nothing*. All of these are no-ops:

```ts
css({
  '&:hover > *': { opacity: '1' },                 // no rule emitted
  '&:hover > [data-row-action]': { opacity: '1' }, // no rule emitted
  '&:hover [data-row-action]': { opacity: '1' },   // no rule emitted
})
```

Meanwhile `:hover` on the element itself **does** apply (button hover works), and a non-hover child combinator **does** apply (e.g. `& > * { pointerEvents: 'auto' }`). Because the rule is never emitted, you can't diagnose it from the DOM: the row's `:hover` matches (`el.matches(':hover') === true`) yet the child's `getComputedStyle(el).opacity` never changes — and all its rules are missing from `document.styleSheets` (the styles get shadow/adopted stylesheet treatment, so dumping `cssRules` shows nothing).

## Solution
Drive the reveal from a `clientEntry` that toggles **inline** `style.opacity` on the targeted children, wired to the row's `mouseenter/mouseleave` and `focusin/focusout`. Give each hidden button a stable attribute (e.g. `data-list-row-actions`) and set its resting opacity via `css()`.

The working implementation is in this repo:

- `app/actions/lists/public/lists-client.tsx` — the clientEntry that toggles inline `opacity`/`pointer-events` on the row-actions cluster from `mouseenter`/`mouseleave`/`focusin`/`focusout`, re-inits on frame `reloadComplete`, and aborts prior listeners (`AbortController`). It also has the **delegated** variant (`mouseover`/`closest('[role="listitem"]')` on a stable container) for lists whose rows re-render on every state change.
- `app/ui/lists-layout.tsx` — the `rowActionsStyle`/`deleteFormStyle`/`renameBtnStyle` cluster styles (resting `opacity: 0; pointerEvents: none`, plus the `@media (hover: none)` override).

### Key details

- **Reveal toggles both `opacity` and `pointer-events`** on the cluster: `pointer-events: none` on the container is what lets clicks pass through to the row beneath, and it must be turned back to `auto` to be interactive.
- **Touch devices: hover-only reveals are unreachable.** Add `@media (hover: none)` so the cluster is always visible and interactive on touch while keeping the hover reveal on pointer devices. Prefer `@media (hover: none)` over a width-based or touch-capability sniff.
- **Force-visibly reveal an actively-editing row** by adding a conditional style (`opacity: 1; pointer-events: auto`) when that row is in edit mode, so its Save/Cancel actions are always visible instead of waiting for hover.
- **Keyboard reachability** — handle `focusin`/`focusout`, not just `mouseenter`/`mouseleave`.

## How to verify
In a browser, hover the row then assert the child's computed opacity changed:

```ts
let before = await btn.evaluate((el) => getComputedStyle(el).opacity) // "0.3"
await row.hover(); await page.waitForTimeout(200)
let after  = await btn.evaluate((el) => getComputedStyle(el).opacity) // "1"
```

Use a still-clickable resting state (so `pointer-events` never traps clicks); gate destructive actions separately (e.g. a `data-confirm` delete) rather than via `pointer-events: none` on the hidden button.

## When to Use
- A hover/focus reveal of per-row actions in a remix3 `remix/ui` app isn't appearing.
- You reached for `&:hover > child` / `&:hover [child]` in `css()` and it does nothing.
- The row matches `:hover` but the child's computed style never changes; `:hover` on the element itself still works.
- You need keyboard reachability as well — handle `focusin`/`focusout`, not just `mouseenter`/`mouseleave`.