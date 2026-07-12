## 1. CSS Theme Fix

- [x] 1.1 Fix `renderSlotButtons()` — replace `var(--surface-lvl1, #f5f5f5)` with `var(--rmx-surface-lvl1)`, add `color: var(--rmx-color-text-primary)`, fix border to `var(--rmx-color-border-default)`
- [x] 1.2 Fix `appendSlotPicker()` — same CSS variable replacements on the slot buttons in the standalone picker

## 2. Client-Side Pagination

- [x] 2.1 Add `SLOTS_PER_PAGE` constant (10) in `appendSlotPicker()` and `renderSlotButtons()`
- [x] 2.2 Implement slot partitioning into page arrays
- [x] 2.3 Render each page as a distinct div with show/hide via CSS `display` toggling
- [x] 2.4 Add pagination bar with "← Zurück" / "Weiter →" buttons and "Seite X von Y" label
- [x] 2.5 Wire prev/next click handlers to switch active page
- [x] 2.6 Verify pagination hides entirely when total slots ≤ `SLOTS_PER_PAGE`

## 3. Verify

- [x] 3.1 Slot buttons visible in light mode (CSS fix applied)
- [x] 3.2 Slot buttons visible in dark mode (`--rmx-*` variables resolve correctly in both themes)
- [x] 3.3 Slot selection on any page uses same `data-slot` attribute format — agent receives correct data
- [x] 3.4 `npm run typecheck` — passed, `npm test` — 973 pass, 0 fail
