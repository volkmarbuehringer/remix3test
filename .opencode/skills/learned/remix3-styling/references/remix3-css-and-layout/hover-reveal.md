# remix3 CSS: hover reveal of child/nested elements

**Source:** `remix3-css-hover-reveal`

**Extracted:** 2026-08-24
**Revalidated:** 2026-10-24 against the installed `@remix-run/component@1.1.0` (build `1e03013e1`, shipped in `remix` 3.1.0) — **the old "no rule emitted" behavior is fixed.**

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

Keep the resting state on the cluster and reveal it from the row's hover/focus state:

```ts
const rowStyle = css({
  position: 'relative',
  '&:hover [data-item-actions]': { opacity: '1', pointerEvents: 'auto' },
  '&:focus-within [data-item-actions]': { opacity: '1', pointerEvents: 'auto' },
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
  transition: 'opacity 0.12s ease',
})
```

- `:focus-within` replaces the JS `focusin`/`focusout` wiring, so keyboard users reveal the cluster without a listener.
- No frame-reload re-init is needed — the CSS class survives DOM replacement.
- Keep `pointer-events: none` at rest so clicks reach the row; reveal sets it back to `auto`.

## App state (2026-10-24)

The old workaround is still present and can be deleted:

- `app/actions/lists/public/lists-view.tsx` — the delegated `mouseover`/`mouseleave`/`focusin`/`focusout` block (~`:1526-1575`) that writes inline `opacity`/`pointerEvents` on `[data-item-actions]`. Replace with the row CSS above.
- `app/actions/lists/public/lists-styles.ts` — `itemActionsStyle` resting state stays; the comment claiming `css()` won't emit descendant `> button` selectors is stale, and `itemButton*` per-button styles can move into a container rule if desired.
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

If a rule still seems missing, inspect the adopted stylesheet/CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets` — the generated rules live in an adopted sheet and do not show up in the document's `cssRules`.
