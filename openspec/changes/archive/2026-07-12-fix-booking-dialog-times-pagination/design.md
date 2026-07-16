## Context

The slot picker is rendered in `app/assets/customer-chat-stream.tsx` — a `clientEntry` (client-side JavaScript, no React). Two functions create slot buttons:

- `renderSlotButtons(result)` — inside the collapsible tool card
- `appendSlotPicker(result)` — standalone prominent picker below the tool card

Both use inline styles with `var(--surface-lvl1, #f5f5f5)` for button backgrounds and no explicit `color`. The theme contract defines CSS variables with the `--rmx-` prefix (e.g., `--rmx-surface-lvl1`, `--rmx-color-text-primary`). Since the wrong variable names are used, the fallback `#f5f5f5` fires in both themes — invisible text in dark mode where the inherited body text is `#dee2e6` (light gray).

The `findNextAvailableSlots` tool returns up to 10 days of unlimited slots. All are appended to the DOM at once with no paging controls.

Constraints: no server changes, no tool contract changes, no new API surface. The agent must not be aware of pagination.

## Goals / Non-Goals

**Goals:**

- Slot button text is legible in light and dark mode
- The slot picker shows a fixed number of "pages" with prev/next navigation
- Only the selected slot (with its full data) reaches the agent — pagination is purely client-side

**Non-Goals:**

- No server-side changes (no tool param changes, no API endpoints)
- No changes to the tool result format or SSE event contract
- No changes to the agent instructions or behavior

## Decisions

### Bug 1: CSS Fix — Use correct theme variables and explicit color

**Decision:** Replace the bare CSS variable references with the correct `--rmx-` prefixed ones, and add an explicit `color` so buttons don't inherit from body in dark mode.

Before:

```
background: var(--surface-lvl1, #f5f5f5);
```

After:

```
background: var(--rmx-surface-lvl1);
color: var(--rmx-color-text-primary);
border: 1px solid var(--rmx-color-border-default);
```

**Alternative considered:** Adding `color-scheme` detection or a dark-mode override. Rejected because the `--rmx-*` variables already exist and are the canonical way to respect themes. This also fixes the border color which had the same bug (`--border-color` instead of `--rmx-color-border-default`).

### Bug 2: Pagination — Client-side DOM segment toggling

**Decision:** Wrap slot groups into page segments, render all segments, show only the active one via `display: none` / `display: block`. Add prev/next buttons that increment a page counter.

```
┌─ Termin buchen — Massage ──────────────────┐
│                                             │
│  Do 10.07.                                  │
│  [05:00–06:00] [06:00–07:00] [07:00–08:00] │
│  [08:00–09:00] [09:00–10:00]               │
│                                             │
│  Fr 11.07.                                  │
│  [09:00–10:00] [10:00–11:00]               │
│                                             │
│  Seite 1 von 3  ← Zurück  Weiter →         │
└─────────────────────────────────────────────┘
```

**Page size:** Hard-code `SLOTS_PER_PAGE = 10` (slots, not days — so a page might have 2-3 days). Kept as a constant at the top of the clientEntry for easy adjustment.

**Implementation approach:**

```js
function appendSlotPicker(result) {
  const SLOTS_PER_PAGE = 10
  let pages = []
  let currentPage = []

  // Partition slots into pages of SLOTS_PER_PAGE
  for (let s of slots) {
    currentPage.push(s)
    if (currentPage.length >= SLOTS_PER_PAGE) {
      pages.push(currentPage)
      currentPage = []
    }
  }
  if (currentPage.length > 0) pages.push(currentPage)

  // Render each page as a div with id="slot-page-N"
  // Show only page 0, hide others
  // Add pagination bar: "Seite X von Y  ← Zurück  Weiter →"
  // Click handlers toggle which page div is visible
}
```

**Alternative considered:** Using a `<details>`-style expand for each day. Rejected because the problem is total slot count, not day count. A resource with slots at every hour for 5 days = 50+ buttons. Pagination by slot count handles both cases.

### Architecture notes

- Both `renderSlotButtons()` (tool card) and `appendSlotPicker()` (standalone) need the fix — the tool card rendering also has invisible buttons in dark mode
- The pagination bar should be a thin row below the last day group, not inside the scrollable slot list
- "← Zurück" is disabled on page 1, "Weiter →" is disabled on the last page
- The slot click handler (`handleSlotClick`) reads `data-slot` from the button — it doesn't change since the data attribute always carries the full slot info

## Risks / Trade-offs

- **[UX]** Pagination means the user must click "Weiter" to see more slots — slightly more friction than infinite scroll. Acceptable because slot picking is a deliberate action, not browse-heavy.
- **[Edge case]** If slots are exactly N per page, the last page button still works (empty page is never created since the partition only makes a new page when there are slots).
- **[Maintenance]** `SLOTS_PER_PAGE` is hard-coded. If we want user-configurable page size later, this would need a small refactor. Fine for now.
