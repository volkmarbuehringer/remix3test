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
`admin-offering-configs-page.tsx` did not.

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

## Verification

Measure, do not eyeball: at ~1440px with the panel open,
`wrap.scrollWidth === wrap.clientWidth` (no horizontal overflow) and the `Aktionen`
header is visible. At 390px, `getComputedStyle(thead).display === "none"` and every
`td[data-label]` is present.

## Related

- `references/cascade-layer-overrides.md` — why the `min-width` override needs
  `!important`
- `remix3-data-table` — the data layer behind these grids