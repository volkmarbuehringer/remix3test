## Context

The `/client` route renders a grid via `<Frame name="client-grid">`. Clicking "Edit" navigates to a standalone `/client/edit/:rowId` page with its own `<Layout>`, losing the grid context entirely. The save action POSTs to `/client/save` which 302 redirects back to `/client`, causing a full page reload and grid refetch.

This design places the edit form inline alongside the grid, so both are visible simultaneously. The grid state (offset, sort, order, filter) is carried through the URL throughout the edit → save lifecycle.

## Goals / Non-Goals

**Goals:**
- Grid and edit form visible side-by-side on the same page
- All grid state preserved through edit → save → redirect cycle
- Zero new JavaScript — standard HTML form POST, server-rendered frames
- Single canonical path for editing via `?editing=` query param
- Remove standalone `/client/edit/:rowId` route

**Non-Goals:**
- Client-side save or optimistic updates — form POST + 302 redirect is sufficient
- Drag-to-reorder or inline cell editing — this is form-panel editing, not spreadsheet-style
- Mobile-responsive layout — the two-column grid is desktop-first (can be added later)

## Decisions

### Query param over frame for edit panel
`?editing=` param drives edit panel visibility rather than a second `<Frame>`. Rationale:
- Form POST + 302 redirect naturally clears `?editing=`, removing the panel
- No additional frame lifecycle to manage
- Edit panel is server-rendered alongside the grid frame, no extra network request
- Grid frame preserves its state independently across page navigations

### target="_top" for frame exit
Edit button inside the grid frame must navigate the top-level page. `target="_top"` is the established pattern in the admin layout — consistent and reliable.

### Single edit component, no standalone path
Since the standalone route is removed, `ClientEditPage` is always inline. No prop to toggle between modes, no dual-rendering logic. Simpler to maintain.

### Filter preserved through URL
The filter param flows through every step: grid → edit (in URL) → save (hidden form field) → redirect back to grid. This prevents losing the user's search context.

## Risks / Trade-offs

- **Grid frame reload on save**: After the 302 redirect, the grid frame re-fetches its data. A brief loading flash is possible if the frame has no `fallback`. → Mitigation: Add a skeleton `fallback` to the grid frame if the flash is noticeable.
- **Mobile layout**: `1fr 380px` grid breaks on narrow viewports. → Out of scope for this change; a `@media` stack can be added later.
- **Delete while editing**: If the user deletes the row they're editing, the 302 from the destroy action clears the edit panel. Expected behavior — the row is gone.
