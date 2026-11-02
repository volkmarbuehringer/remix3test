# remix3 CSS: hover reveal of child/nested elements

**Source:** `remix3-css-hover-reveal`

**Extracted:** 2026-08-24
**Revalidated:** 2026-10-26 against the installed `@remix-run/component@1.1.0` (build `8ae2f755`, shipped in `remix` 3.1.0) — **the old "no rule emitted" behavior is fixed; the `:focus-within` recommendation was replaced after a reorder bug.**

## Status: the CSS selector works now

On current builds `css()` emits nested parent→child rules verbatim and the browser applies them inside the adopted `@layer rmx.*` stylesheet. Verified in Chromium and Firefox with an adopted stylesheet and the runtime's `@layer` wrapper:

```ts
css({
  '&:hover > *': { opacity: '1' },
  '&:hover > [data-row-action]': { opacity: '1' },
  '&:hover [data-row-action]': { opacity: '1' },
})
```

All three now match. Complex child selectors (`& > form > button`, `& > a`) also work, so per-button group styling can live on the container.

**Legacy note (pre-fix builds only):** the original delta reported that these selectors emitted nothing, while `:hover` on the element itself and non-hover child combinators worked; the fallback was a `clientEntry` toggling inline `style.opacity`. Do not apply that fallback on current builds.

## Preferred solution

Keep the resting state on the cluster and reveal it from the row's hover state, plus **`:focus-visible`** (not `:focus-within`) for keyboard focus:

```ts
const rowStyle = css({
  position: 'relative',
  '&:hover [data-item-actions]': { opacity: '1', pointerEvents: 'auto' },
  '&:focus-visible [data-item-actions]': { opacity: '1', pointerEvents: 'auto' },
  // Descendant keyboard focus (action buttons, checkboxes) — `:focus-visible`
  // on the row itself does not match a focused child.
  '&:has(:focus-visible) [data-item-actions]': { opacity: '1', pointerEvents: 'auto' },
  '@media (hover: none)': { /* touch: rely on the kebab menu, below */ },
})

const itemActionsStyle = css({
  position: 'absolute',
  top: '50%',
  right: theme.space.sm,
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  opacity: 0,
  pointerEvents: 'none',
  // No opacity transition: see the reorder note below.
})
```

- **`:focus-visible` ≠ `:focus-within` for pointer interactions.** A mouse click focuses the button but does **not** match `:focus-visible`. `:focus-within` therefore pins the cluster open for as long as that button keeps focus.
- **Reorder trap (observed on /lists):** keyed sibling reorders do not always move the clicked row's DOM node. Moving a row *down* leaves the clicked row's node in place (the following row is `insertBefore`-moved), so the clicked ↑/↓ button keeps focus while the row that slid under the stationary cursor reveals its own cluster via `:hover` — two toolbars visible at once. With `:focus-within` this persists until the user clicks elsewhere. Gate on `:focus-visible` and the pointer-clicked row hides; keyboard-triggered focus still reveals it.
- **Remove the opacity transition on the cluster.** When a reorder swaps hover between adjacent rows, a symmetric fade leaves both clusters partially visible for ~120 ms (a "duplicated" toolbar). An instant swap shows exactly one.
- **Restore focus explicitly after a reorder.** Re-inserting the focused row detaches it and blurs the button (focus falls to `<body>`), so re-focus the same ↑/↓ button by item id after the update (`handle.queueTask`); when the move reaches a boundary that button is disabled, fall back to focusing the row. Pointer-restored focus is not `:focus-visible`, so it does not re-open the cluster.
- No frame-reload re-init is needed — the CSS class survives DOM replacement.
- Keep `pointer-events: none` at rest so clicks reach the row; reveal sets it back to `auto`.

## App state (2026-10-26)

The delegated `mouseover`/`mouseleave`/`focusin`/`focusout` block has been removed. Current wiring:

- `app/actions/lists/public/lists-view.tsx` — the row's `:hover` / `:focus-visible` / `:has(:focus-visible)` reveal rules; ↑/↓ click handlers call `moveUp`/`moveDown` then `focusItemAction(item.id, label)`.
- `app/actions/lists/public/lists-client.tsx` — `focusItemAction` re-focuses the same arrow button after the queued update, falling back to the row at list boundaries.
- `app/actions/lists/public/lists-styles.ts` — `itemActionsStyle` resting state; no opacity transition on the view cluster.
- `app/actions/lists/public/lists-row-actions.tsx` is **not** the hover reveal — it is the kebab/inline menu controller (touch/dense-row alternative), still needed.

## Touch and dense rows

- Hover-only reveals are unreachable on touch. Prefer a kebab + inline menu (see `remix3-ui` § Client Entries → `references/remix3-client-entries/touch-row-action-menu.md`) or an always-visible cluster under `@media (hover: none)`.
- Force-reveal an actively-editing row with a conditional style/class (`opacity: 1; pointerEvents: auto`).

## How to verify

In a browser, hover the row and assert the child's computed opacity changed:

```ts
let before = await btn.evaluate((el) => getComputedStyle(el).opacity) // "0"
await row.hover()
let after = await btn.evaluate((el) => getComputedStyle(el).opacity) // "1"
```

For the reorder regression, drive the real pointer path and assert exactly one cluster has `opacity > 0.5` (the row under the stationary cursor), while focus rests on the moved row: `app/actions/lists/lists-row-toolbar.test.e2e.ts` covers both the pointer ↓ move and a keyboard ↑ move. The test fails with `:focus-within` (two visible clusters) and passes with the focus-visible gating.

If a rule still seems missing, inspect the adopted stylesheet/CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets` — the generated rules live in an adopted sheet and do not show up in the document's `cssRules`.
