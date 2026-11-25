# remix3 CSS: hover reveal of child/nested elements

**Source:** `remix3-css-hover-reveal`

**Extracted:** 2026-08-24
**Revalidated:** 2026-11-19 against source `9e4da4d3` (`@remix-run/component` 1.3.0).
**Revised:** 2026-11-23 — row action overlays are trigger-gated on the kebab across all admin/Verwaltung grids and `/lists` item rows. Guide 04 §"Styling with css and dynamic style values" gained the per-style `@layer rmx.*` paragraph at #12352; the reveal mechanics below are unchanged, and the app's hover reveals are exercised by `app/actions/admin/admin-grid-floating-actions.test.e2e.ts` and `app/actions/lists/lists-row-toolbar.test.e2e.ts` on the current pin.

## Current behavior

`css()` emits nested parent→child rules verbatim and the browser applies them inside the adopted `@layer rmx.*` stylesheet. `&:hover > *`, `&:hover > [data-row-action]`, and `&:hover [data-row-action]` all match (verified in Chromium + Firefox); complex child selectors (`& > form > button`, `& > a`) also work, so per-button group styling can live on the container.

The pre-fix fallback — a `clientEntry` toggling inline `style.opacity` because these selectors emitted nothing — is gone. Do not reintroduce it on current builds.

## Preferred solution: trigger-gated reveal

Gate pointer reveal on the explicit kebab trigger or the overlay itself, not the
whole row. Keep **`:focus-visible`** (not `:focus-within`) for keyboard focus,
and add a row-level open marker for a click-pinned overlay:

```ts
const rowStyle = css({
  position: 'relative',
  '&:has([data-row-actions-trigger]:hover, [data-row-actions]:hover) [data-row-actions]': {
    opacity: '1 !important',
    pointerEvents: 'auto !important',
  },
  // Descendant keyboard focus (action buttons, checkboxes) — `:focus-visible`
  // on the row itself does not match a focused child.
  '&:has(:focus-visible) [data-row-actions]': {
    opacity: '1 !important',
    pointerEvents: 'auto !important',
  },
  '&[data-row-actions-open] [data-row-actions]': {
    opacity: '1 !important',
    pointerEvents: 'auto !important',
  },
})

const rowActionsStyle = css({
  position: 'absolute',
  top: '50%',
  // Touch the trigger: no hover dead zone between kebab and cluster.
  right: 'calc(30px + 8px)',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  opacity: 0,
  pointerEvents: 'none',
  // No opacity transition: see the reorder note below.
})
```

For `/lists` item rows the same shape uses
`[data-item-menu-button]` / `[data-item-actions]` with
`right: calc(36px + 8px)`; the admin and Verwaltung grids use
`[data-row-actions-trigger]` / `[data-row-actions]` with the 30px trigger inset.

- **The overlay must touch the trigger.** A visual gap (e.g. 4px) is a hover
  dead zone: leaving the kebab drops `:hover` before the pointer reaches the
  overlay, so the hidden cluster never receives the pointer. Make the cluster's
  right inset equal the trigger's width + its right inset, or add an invisible
  hover bridge.
- **Select the trigger or the overlay, never the whole row.** As soon as the
  overlay becomes interactive, a row-wide reveal can sit under the pointer and
  steal a click intended for row content. The explicit second selector
  (`[data-row-actions]:hover`) keeps the cluster open while moving from the
  trigger into it.
- **Sublayer caveat (`53dad21e`, guide 04 §"Styling with css and dynamic style values"):** the cluster's own style sets `opacity`/`pointer-events`, and each `css()` style is its own `@layer rmx.*` sub-layer, so a later sub-layer wins regardless of specificity. The parent reveal therefore needs `!important` on both properties (as `lists-view.tsx` and `admin-table.ts` do), or the reveal must live in the cluster's own style — see `cascade-layer-overrides.md`.
- **`:focus-visible` ≠ `:focus-within` for pointer interactions.** A mouse click focuses the button but does **not** match `:focus-visible`. `:focus-within` therefore pins the cluster open for as long as that button keeps focus.
- **Reorder trap (observed on /lists):** keyed sibling reorders do not always move the clicked row's DOM node. Moving a row *down* leaves the clicked row's node in place (the following row is `insertBefore`-moved), so the clicked ↑/↓ button keeps focus while the row that slid under the stationary cursor used to reveal its own cluster via row `:hover` — two toolbars visible at once. With trigger-gated reveal, the row under the pointer stays passive; keep `:focus-visible` gating so only a keyboard-triggered cluster opens.
- **Remove the opacity transition on the cluster.** When a reorder swaps hover between adjacent rows, a symmetric fade leaves both clusters partially visible for ~120 ms (a "duplicated" toolbar). An instant swap shows exactly one.
- **Restore focus explicitly after a reorder.** Re-inserting the focused row detaches it and blurs the button (focus falls to `<body>`), so re-focus the same ↑/↓ button by item id after the update (`handle.queueTask`); when the move reaches a boundary that button is disabled, fall back to focusing the row. Pointer-restored focus is not `:focus-visible`, so it does not re-open the cluster.
- **Dual-mode menus need one state and one visible surface.** Render the inline touch menu and floating desktop cluster from the same open state. On desktop, hide the inline menu with CSS and reveal the floating cluster through `[data-*-actions-open]`; focus the first floating action. On touch/narrow, focus the first inline menu button. Outside-pointer dismissal must exempt both the menu and the floating cluster.
- No frame-reload re-init is needed — the CSS class survives DOM replacement.
- Keep `pointer-events: none` at rest so clicks reach the row; reveal sets it back to `auto`.
- **Gate destructive actions separately** (e.g. the `data-confirm` prompt the row actions already carry), never by trapping clicks on the cluster with `pointer-events`: the reveal already uses `pointer-events` for hit-testing, so overloading it breaks the reveal and leaves the destructive action without its confirmation gate.

## Why trigger-gated: pointer interception

A row-wide reveal can make an overlay appear under a pointer that is already
over row content. Enabling `pointer-events` at that moment makes the overlay
the click target for the next click intended for the underlying content. This
is most visible when a primary link spans the row, but the same failure applies
to any row action overlay.

Playwright symptom:

```text
<button data-list-rename-btn> ... intercepts pointer events
while clicking [data-list-id="…"] a[href*="load="]
```

Gate reveal on the explicit trigger or the overlay itself. Keep keyboard
discovery with `:has(:focus-visible)`.

E2E helpers must hover the trigger, not the row:

```ts
await page.locator(`[data-list-id="${id}"] [data-list-menu-button]`).hover()
await page.locator(`[data-list-id="${id}"] [data-list-rename-btn]`).click()
```

Add both regression checks:

1. Hover the row and assert the overlay remains at `opacity: 0`.
2. Hover the kebab, then assert the overlay action remains clickable and that
   moving from the trigger into the overlay keeps it visible.

Observed on `/lists` sidebar rows (2026-11-22) and extended to `/lists` item
rows plus every admin/Verwaltung floating row-action grid (2026-11-23).

## App state (2026-11-23)

The delegated `mouseover`/`mouseleave`/`focusin`/`focusout` block has been removed. Current wiring:

- `app/actions/lists/public/lists-view.tsx` — item-row kebab/overlay-hover reveal, `:has(:focus-visible)`, and `[data-item-actions-open]` for click-pinned desktop actions. The kebab is rendered at every width; desktop hides the inline copy and pins the floating cluster.
- `app/actions/lists/public/lists-client.tsx` — `openItemMenuId` drives both surfaces; desktop focus goes to the first floating action, touch/narrow focus goes to the first inline menu button. Outside-pointer dismissal exempts `[data-item-menu]`, `[data-item-actions]`, and `[data-item-menu-button]`.
- `app/actions/lists/public/lists-styles.ts` — item kebab is always visible; floating item actions are desktop-only and touch the kebab; inline menu is hidden on desktop.
- `app/ui/mixins/admin-table.ts` — `floatingRowReveal` is trigger-gated on `[data-row-actions-trigger]:hover`/`[data-row-actions]:hover`; `floatingTrailingFade` uses the same gate (plus focus/open) so the covered trailing cell does not peek out.
- `app/ui/lists-layout.tsx` — sidebar kebab reveal is trigger-gated with the same shape.
- `app/actions/lists/public/lists-row-actions.tsx` is the kebab/inline controller for the sidebar; it is not the CSS reveal itself.

Coverage: `app/actions/admin/admin-grid-floating-actions.test.e2e.ts`,
`app/actions/admin/lists/lists-ux.test.e2e.ts`,
`app/actions/verwaltung/grid-floating-actions.test.e2e.ts`,
`app/actions/lists/lists-row-toolbar.test.e2e.ts`,
`app/actions/lists/lists-compact-layout.test.e2e.ts`.

## Touch and dense rows

- Hover is unreachable on touch. Keep the kebab visible and let it open an
  inline menu; on desktop the same kebab reveals/pins the floating cluster. See
  `remix3-ui` § Client Entries → `references/remix3-client-entries/lists-editor.md`.
- Do not add a separate always-visible touch cluster when the kebab is already
  the interaction contract; one state and one visible surface is easier to
  verify and avoids duplicate menus.
- Force-reveal an actively-editing row with a conditional style/class (`opacity: 1; pointerEvents: auto`).

## How to verify

In a browser, assert row hover stays passive and kebab hover reveals the
child's computed opacity:

```ts
let before = await btn.evaluate((el) => getComputedStyle(el).opacity) // "0"
await row.hover()
let rowHover = await btn.evaluate((el) => getComputedStyle(el).opacity) // "0"
await kebab.hover()
let kebabHover = await btn.evaluate((el) => getComputedStyle(el).opacity) // "1"
```

Also move the pointer from the kebab into the overlay and assert it remains
`opacity: 1`; with a gap between trigger and cluster it collapses back to `0`.

For the reorder regression, drive the real pointer path and assert at most one
cluster has `opacity > 0.5`, and if one is visible it belongs to the focused
moved row. A row under the stationary cursor must not reveal with
trigger-gated CSS: `app/actions/lists/lists-row-toolbar.test.e2e.ts` covers both
the pointer ↓ move and a keyboard ↑ move. The test fails with row-hover or
`:focus-within` duplicates and passes with trigger + focus-visible gating.

If a rule still seems missing, inspect the adopted stylesheet/CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets` — the generated rules live in an adopted sheet and do not show up in the document's `cssRules`.
