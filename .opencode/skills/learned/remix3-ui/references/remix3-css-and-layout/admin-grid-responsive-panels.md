# Responsive admin grids and the two-column edit panel

**Extracted:** 2026-10-08
**Context:** The `/verwaltung` appointments, resources and offering-configs grids.
Three of five grids had no mobile layout (dates and row actions scrolled off the
right edge), and opening the inline edit/create panel clipped the grid columns even
on a 1440px desktop because the fixed table `min-width` exceeded the space left by
the panel.

## 1. Every app grid needs `mobileCards` plus `data-label`

`table.wrap` alone keeps `table` at its fixed `min-width: 840px`, so on a phone the
table overflows horizontally and the right-hand columns (Datum, Zeit, Aktionen) are
unreachable. `table.mobileCards` is the opt-in fix: below 768px it hides `thead` and
turns each row into a card whose cells are labelled from `attr(data-label)`.

Two requirements that are easy to miss:

- Apply it to the **container**: `<div mix={[table.wrap, table.mobileCards]}>`.
- Put `data-label` on **every** `<td>`, including the actions cell, or that cell
  renders an unlabelled value:

```tsx
<td mix={table.td} data-label="Datum" title={...}>...</td>
<td mix={table.actionCell} data-label="Aktionen">...</td>
```

`admin-offerings-page.tsx` and `admin-report1-page.tsx` already did this;
`admin-appointments-page.tsx`, `admin-resources-page.tsx` and
`admin-offering-configs-page.tsx` did not. `/admin/messages` was the worst case: a
fixed 840px table on a phone hid both the timestamp and the row actions behind a
horizontal scroll.

## 2. Two-column edit panels clip the grid

The panel layout is `table.twoColumn` = `minmax(0, 1fr) 340px` inside `table.page`,
which caps at `maxWidth: 1000px`. The grid column is therefore
`1000 - 340 - 20 = 640px`, but `table.table` sets `minWidth: 840px`, so `table.wrap`
scrolls and the `Aktionen` column disappears.

Fix (all three, in `app/ui/mixins/admin-table.ts`):

- `pageWide: css({ maxWidth: "none" })` — use it instead of `table.page` in the panel
  branch, so the grid gets the full layout width.
- Narrow the panel to 340px with a 20px gap, and stack it under the grid below
  1100px: `@media (max-width: 1100px) { gridTemplateColumns: "1fr" }`.
- `twoColumnGrid` lowers the table floor while the panel is open:

```ts
twoColumnGrid: css({
  "@media (min-width: 1101px)": {
    "& table": { minWidth: "640px !important" },
  },
}),
```

The `!important` and the media query are both load-bearing:

- Without `!important` the rule loses to `table` `min-width` at random — both live in
  sibling `@layer rmx.*` sub-layers where declaration order, not specificity, decides
  (see `references/cascade-layer-overrides.md`).
- Without `@media (min-width: 1101px)` it fights `mobileCards`, which sets
  `min-width: 0 !important` below 768px; two `!important` declarations then resolve by
  layer order and the mobile card layout can lose.

Apply the class to the grid section only when a panel shares the row:
`mix={[table.minWidth0, hasFormPanel ? table.twoColumnGrid : undefined]}`.

## 3. Sidebar-shell grids: the 640px floor still clips

The 640px `twoColumnGrid` floor above was measured in the plain `/verwaltung`
layout, where `pageWide` gets the full 1000px page width. `createSidebarLayout`
(the `/admin/*` grids) has a narrower content column: at 1440px the sidebar
(220px), shell gap (20px) and `pageStyle` max-width (1200px) leave ~908px, so
the panel row gives the grid `908 - 340 - 20 = 548px`. A 640px table floor still
overflows and pushes the `Aktionen` column behind the horizontal scrollbar —
the row buttons are effectively invisible while editing.

Fix (verified on `/admin/users`):

- Keep `pageWide` for the panel row, but **drop `table.twoColumnGrid`** in the
  sidebar shell; its 640px floor is still too wide.
- In panel mode render only the columns needed to choose a row (identity, role,
  status, actions) and omit ID/created — the panel repeats those values.
- Give that focused table a page-local floor:
  `css({ minWidth: '480px !important' })` (the `!important` is required for the
  layer reason above).
- When the panel closes, restore the full column set.

Measured at 1440px with `/admin/users?editing=2`: grid wrapper 548px, table
536px, `wrap.scrollWidth === wrap.clientWidth`, `Aktionen` fully inside.

## 4. Short result sets: don't grow the row region

`dataGridWrap` is `flex: 1 1 auto`, so in the sidebar shell's full-height list
view it expands to fill the page. With four rows that leaves a tall empty
bordered panel under the table. Use a page-local wrapper instead:

```ts
css({ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable' })
```

The table stays at content height while it fits and shrinks into an internal
scroller only when rows exceed the remaining height, so the pagination stays
pinned. Measured on `/admin/users` with four rows: wrap and table both 253px
(no empty panel); the page scroller was 918px.

On a bounded grid that also opts into `mobileCards` (`/admin/messages`), the
`dataGridWrap` mixin still sets `flex: 1 1 auto` and so keeps a short nested
scroller on phones even after the table becomes cards. Add a page-local media
override:

```ts
const gridWrapStyle = css({
  '@media (max-width: 768px)': { flex: '0 0 auto', overflowY: 'visible' },
})
```

The wrap then measures content-height, the page scroller owns the scroll, and
`wrap.scrollHeight === wrap.clientHeight`. The `overflowY` override is not
strictly load-bearing because `flex: 0 0 auto` already removes the fixed height,
but it documents that this region must not clip; `table.wrap` keeps `overflowX:
auto` for the desktop floor.

## 5. Stacked layout: put the opened panel first

Below 1100px the panel stacks under the grid. `PageScrollReset` returns the
page scroller to the top after a frame navigation, so opening `?editing=<id>`
from a row leaves the editor off-screen. Add `order: -1` at
`@media (max-width: 1100px)` on the panel wrapper (or on its grid item) so the
panel the user just opened is the first thing in view. This trades strict
DOM/visual order on phones for a visible editor; the grid stays reachable
below.

## Verification

Measure, do not eyeball: at ~1440px with the panel open,
`wrap.scrollWidth === wrap.clientWidth` (no horizontal overflow) and the `Aktionen`
header is visible. At 390px, `getComputedStyle(thead).display === "none"` and every
`td[data-label]` is present.

For the sidebar-shell variant, also measure the focused table at 1440px
(`/admin/users?editing=2`): wrapper ~548px, table ~536px, no horizontal
overflow. In list view with a short page, assert the wrap height matches the
table height instead of the 918px page scroller.

## Related

- `references/cascade-layer-overrides.md` — why the `min-width` override needs
  `!important`
- `references/plain-layout-bounded-grid.md` — the `dataGrid*` fill chain and
  `flex: 1 1 auto`
- `remix3-data-table` — the data layer behind these grids