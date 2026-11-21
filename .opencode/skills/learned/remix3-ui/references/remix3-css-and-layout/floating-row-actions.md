# Floating row actions for wide admin grids

**Extracted:** 2026-10-28
**Updated:** 2026-11-21
**Context:** Admin grids in this app (`/admin/lists`, `/admin/users`, `/admin/chatlog`, `/admin/clients`). Shared implementation: `app/ui/mixins/admin-table.ts` (`floatingActions*`, `floatingRowReveal`, `floatingTrailingFade`) plus `app/ui/admin-row-actions-overlay.browser.tsx`. Reveal mechanics: `hover-reveal.md`; list-sidebar variant: `app/ui/lists-layout.tsx`.

## Problem

A 6–7 column admin grid inside the ~896px content column pushes the Aktionen column behind a horizontal scrollbar, or wastes 80–120px on it. The current treatment reserves a narrow kebab gutter and reveals the joined `table.actionGroup` to its left on hover/keyboard focus. The kebab stays visible, pins the overlay open on click, and moves focus into the actions.

Do **not** collapse the kebab gutter to zero width. A zero-width action column makes the persistent trigger float directly over the trailing date/count cell — visibly detached and overlapping data in `/admin/lists` and `/admin/clients`. Reserve 44px for the kebab; the action overlay still reclaims the rest of the old action column by covering the previous cell.

Copying that to every grid is wrong:

- the action buttons are still one hover/click away — a persistent kebab helps discovery but does not make every action immediately visible,
- it covers the last data cell, which must then be redundant (a timestamp, or something the edit panel repeats),
- grids with one action (messages), bulk selection (uploads), or blocked self-actions (users) carry their own affordance and may not overflow.

Adopt per grid when the table has width pressure or the product wants one consistent row-action interaction, and the covered cell is disposable; keep the visible group (`table.actionGroup` / `actionSeg`) everywhere else.

## Contract

```tsx
<col mix={[pageBaseWidth, table.floatingActionsCol]} />
<th scope="col" aria-label="Aktionen" mix={[table.th, table.floatingActionsHeader]}>
  <span mix={table.floatingActionsHeaderText}>Aktionen</span>
</th>
<tr mix={[table.row, table.floatingRowReveal, table.floatingTrailingFade]}>
  <td mix={table.td} data-floating-trailing>…</td>
  <td mix={[table.actionCell, table.floatingActionCell]}>
    <button
      type="button"
      data-row-actions-trigger
      aria-expanded="false"
      aria-controls={`row-actions-${row.id}`}
      aria-label={`Weitere Aktionen für ${row.name}`}
      mix={table.floatingActionsTrigger}
    >⋮</button>
    <div
      id={`row-actions-${row.id}`}
      mix={[table.actionGroup, table.floatingActions]}
      role="group"
      aria-label="Zeilenaktionen"
      data-row-actions
    >…</div>
  </td>
</tr>
```

- Overlay only under `@media (min-width: 1200px) and (hover: hover)`; at every other width the same markup renders in flow. The page must supply the fallback (card layout or the visible column) — never hide the cluster without one.
- Reserve exactly `44px !important` for the column, header and action cell. This is a kebab footprint, not a zero-width gutter. The overlay action group sits `right: calc(30px + 12px)`: 8px inset + 30px trigger + 4px gap. Keep the trigger at `right: theme.space.sm`.
- Mount one `AdminRowActionsOverlay` client entry per page. Its delegated controller toggles `data-row-actions-open` on the row, sets `aria-expanded`, focuses the first action, closes on Escape/outside pointerdown, and restores focus to the kebab. `floatingRowReveal` must reveal on hover, `:has(:focus-visible)`, **and** `[data-row-actions-open]`.
- Fade the trailing cell (`data-floating-trailing`) on hover/focus/open so digits/badges do not peek out beside the buttons. Tag only the cell the cluster actually covers (users swaps it between `Erstellt` and `Status` when the edit panel opens; lists tags `Elemente` in the focused layout).
- Keep the header `aria-label`; hide the visible label span above the breakpoint. A page that never shows the column (cards below the breakpoint) omits the span.
- Blocked actions stay focusable: `type={blocked ? 'button' : 'submit'}` + `aria-disabled="true"`, never native `disabled`. The hover-hidden cluster is only revealed by `:has(:focus-visible)`; native `disabled` drops the control from the tab order, so its reason becomes unreachable.
- Below the breakpoint hide the kebab (`display: none`) and let the normal action column render in flow. Do not keep the trigger visible beside the already-visible action group.

## Pitfalls (observed 2026-10-28; extended 2026-11-21)

1. **A breakpoint constant used as a `css()` key must include `@media `.** With `const m = '(min-width: 1200px) and (hover: hover)'` and `css({ [m]: { … } })` the rules silently do nothing — the cluster stayed visible at 1440px and every e2e opacity assertion failed. Store the full query (`'@media (min-width: 1200px) and (hover: hover)'`) or write the key inline.
2. **`innerText` reflects `text-transform: uppercase`.** Admin `table.th` uppercases labels, so `header.innerText.includes('Aktionen')` is false even when the label is visible. Compare case-insensitively; `textContent` sees hidden labels too, so it cannot prove visibility.
3. **`CSS.escape` is browser-only.** A Playwright test that builds `[data-row-id="…"]` in Node cannot call it; escape `"` and `\` with a small helper.
4. `:focus-within` pins the cluster open after a pointer click; gate on `:has(:focus-visible)` (see `hover-reveal.md`).
5. **Playwright cannot click the hidden cluster on its own.** Hover the row first; the pre-click hit test versus `pointer-events: none` is documented in `remix3-tooling` § Testing → `references/remix3-testing/input-modality-and-hover-testing.md`.
6. **Zero-width action columns break the persistent-trigger variant.** The kebab is absolutely positioned inside the action cell; with a zero-width cell it lands over the last data column instead of in its own gutter. Keep the 44px column and assert its width, not `≤1px`.
7. **Hydration-gap clicks are silent no-ops.** The trigger is server-rendered but its delegated controller attaches after hydration. Expose a `data-admin-row-actions-ready` marker and wait for it in E2E before clicking the kebab.

## Measured fit (2026-11-21)

The persistent-kebab variant is active on `/admin/lists`, `/admin/users`, `/admin/chatlog`, and `/admin/clients`. The clients grid was migrated from a 120px visible action column to the 44px kebab gutter; its date column no longer runs under the trigger. Clients already fit at 1440px, so this migration was for interaction consistency rather than overflow. `/verwaltung/appointments`, `/verwaltung/resources`, and `/verwaltung/offering-configs` still fit inline and have not adopted the overlay.

## How to verify

At 1440×900 with a seeded row:

- action `<th>`/cell width is ~44px, header `innerText` (lowercased) has no "aktionen";
- kebab trigger is visible with a clickable width/height and starts `aria-expanded="false"`;
- cluster computed opacity 0 → 1 on row hover, `pointer-events: auto` when revealed;
- `[data-floating-trailing]` computed opacity 0 while hovering;
- clicking the kebab sets `aria-expanded="true"`, reveals the cluster and focuses its first action; Escape restores focus to the kebab;
- no horizontal overflow (`wrap.scrollWidth - wrap.clientWidth ≤ 1`).

At 1100×900 (below the breakpoint): kebab `display: none`, header label visible, cluster opacity 1.

Keyboard: focus the row's edit link, press Tab — the blocked action must receive focus (`aria-disabled="true"`) and reveal the cluster.

Coverage: `app/actions/admin/admin-grid-floating-actions.test.e2e.ts` (users/chatlog/clients), `app/actions/admin/lists/lists-ux.test.e2e.ts` (lists + focused grid), plus browser tests for the shared context menus.

## When to Use

- A wide admin table's actions column overflows or costs too much width.
- You are adopting `table.floatingActions*` in a new grid.
- You want a discoverable persistent kebab without giving up the hover-revealed action group.
- A `css()` media override in this app silently does nothing (check the key prefix first).
