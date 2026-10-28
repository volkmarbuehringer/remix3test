# Floating row actions for wide admin grids

**Extracted:** 2026-10-28
**Context:** Admin grids in this app (`/admin/lists`, `/admin/users`, `/admin/chatlog`) after the 2026-10-28 migration. Shared implementation: `app/ui/mixins/admin-table.ts` (`floatingActions*`, `floatingRowReveal`, `floatingTrailingFade`). Reveal mechanics: `hover-reveal.md`.

## Problem

A 6–7 column admin grid inside the ~896px content column pushes the Aktionen column behind a horizontal scrollbar, or wastes 80–120px on it. The `/admin/lists` fix is to drop the column to zero width and float the joined `table.actionGroup` over the row's right edge, revealed on hover/keyboard focus.

Copying that to every grid is wrong:

- it hides actions until hover (discoverability),
- it covers the last data cell, which must then be redundant (a timestamp, or something the edit panel repeats),
- grids with one action (messages), bulk selection (uploads), or blocked self-actions (users) carry their own affordance and may not overflow.

Adopt per grid only when the table actually overflows and the covered cell is disposable; keep the visible group (`table.actionGroup` / `actionSeg`) everywhere else.

## Contract

```tsx
<col mix={[pageBaseWidth, table.floatingActionsCol]} />
<th scope="col" aria-label="Aktionen" mix={[table.th, table.floatingActionsHeader]}>
  <span mix={table.floatingActionsHeaderText}>Aktionen</span>
</th>
<tr mix={[table.row, table.floatingRowReveal, table.floatingTrailingFade]}>
  <td mix={table.td} data-floating-trailing>…</td>
  <td mix={[table.actionCell, table.floatingActionCell]}>
    <div
      mix={[table.actionGroup, table.floatingActions]}
      role="group"
      aria-label="Zeilenaktionen"
      data-row-actions
    >…</div>
  </td>
</tr>
```

- Overlay only under `@media (min-width: 1200px) and (hover: hover)`; at every other width the same markup renders in flow. The page must supply the fallback (card layout or the visible column) — never hide the cluster without one.
- Zero the column/cell/header with `!important`: they compose with `table.th` / `table.actionCell` / the page `<col>` width in sibling `@layer rmx.*` sub-layers where declaration order decides (see `cascade-layer-overrides.md`).
- Fade the trailing cell (`data-floating-trailing`) on hover/focus so digits/badges do not peek out beside the buttons. Tag only the cell the cluster actually covers (users swaps it between `Erstellt` and `Status` when the edit panel opens; lists tags `Elemente` in the focused layout).
- Keep the header `aria-label`; hide the visible label span above the breakpoint. A page that never shows the column (cards below the breakpoint) omits the span.
- Blocked actions stay focusable: `type={blocked ? 'button' : 'submit'}` + `aria-disabled="true"`, never native `disabled`. The hover-hidden cluster is only revealed by `:has(:focus-visible)`; native `disabled` drops the control from the tab order, so its reason becomes unreachable.

## Pitfalls (observed 2026-10-28)

1. **A breakpoint constant used as a `css()` key must include `@media `.** With `const m = '(min-width: 1200px) and (hover: hover)'` and `css({ [m]: { … } })` the rules silently do nothing — the cluster stayed visible at 1440px and every e2e opacity assertion failed. Store the full query (`'@media (min-width: 1200px) and (hover: hover)'`) or write the key inline.
2. **`innerText` reflects `text-transform: uppercase`.** Admin `table.th` uppercases labels, so `header.innerText.includes('Aktionen')` is false even when the label is visible. Compare case-insensitively; `textContent` sees hidden labels too, so it cannot prove visibility.
3. **`CSS.escape` is browser-only.** A Playwright test that builds `[data-row-id="…"]` in Node cannot call it; escape `"` and `\` with a small helper.
4. `:focus-within` pins the cluster open after a pointer click; gate on `:has(:focus-visible)` (see `hover-reveal.md`).
5. **Playwright cannot click the hidden cluster on its own.** The cluster starts `opacity: 0; pointer-events: none` and only reveals on row hover/keyboard focus. Playwright's pre-click hit test runs before it moves the mouse, so it resolves the trailing cell under the still-hidden cluster and times out with "<td …> intercepts pointer events". Hover the row (e.g. `form.locator('xpath=ancestor::tr[1]').hover()`) before `click()`. Fixed this way in `agent-events-frame-redirect.test.e2e.ts` for the users grid in the agent panel (2026-10-28); a manual hover-then-trial click succeeds at 1440/1280.

## Measured fit (2026-10-28)

The two remaining 7-column grids were measured before adopting the overlay (Playwright, Chromium, seeded rows, wrap `scrollWidth - clientWidth`, action-`th` width, trailing-cell gap). Both keep the visible action column — the overlay is not adopted:

| Grid | Columns | Actions | Trailing | 1440 / 1280 | 1100 |
| --- | --- | --- | --- | --- | --- |
| `/admin/clients` | 7 | 120px | Registriert | wrap 896, overflow 0 | wrap 796 vs table 840 → 44px scroll; action cell 28px past the edge |
| `/verwaltung/appointments` | 7 | 96px | Aktualisiert | wrap 983, overflow 0 | wrap 983, overflow 0 |

At `/admin/clients` the overlay breakpoint (≥1200px) is exactly where the grid no longer overflows, so floating the cluster would reclaim width nobody asked for while hiding a discoverable action; the 1100px overflow is below the overlay's reach and is handled by the existing horizontal scroll. Appointments never overflows. Revisit only if the content column narrows or the reclaimed width becomes a requirement.

## How to verify

At 1440×900 with a seeded row:

- action `<th>` width ≤ 1px, header `innerText` (lowercased) has no "aktionen";
- cluster computed opacity 0 → 1 on row hover, `pointer-events: auto` when revealed;
- `[data-floating-trailing]` computed opacity 0 while hovering;
- no horizontal overflow (`wrap.scrollWidth - wrap.clientWidth ≤ 1`).

At 1100×900 (below the breakpoint): column width > 0, header label visible, cluster opacity 1.

Keyboard: focus the row's edit link, press Tab — the blocked action must receive focus (`aria-disabled="true"`) and reveal the cluster.

Coverage: `app/actions/admin/admin-grid-floating-actions.test.e2e.ts` (users/chatlog), `app/actions/admin/lists/lists-ux.test.e2e.ts` (lists + focused grid).

## When to Use

- A wide admin table's actions column overflows or costs too much width.
- You are adopting `table.floatingActions*` in a new grid.
- A `css()` media override in this app silently does nothing (check the key prefix first).
