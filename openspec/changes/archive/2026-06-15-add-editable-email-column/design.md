## Context

The `/client` grid page is server-rendered with a sidebar edit form. Editing email requires: click Edit → sidebar opens → change input → submit → page reload. This is heavy for a single field. We want to prove inline editing works with a single `clientEntry` component (delegation pattern, not per-row hydration).

The appointment grid already proves this pattern works: one `clientEntry`, all blocks managed via `Map<id, state>`, event delegation on container elements. This change replicates that pattern for the client table.

## Goals / Non-Goals

**Goals:**

- Email column cells are click-to-edit inline (click → `<input>` → save on blur/Enter → revert to text)
- Single `clientEntry` manages all rows — no per-row `clientEntry`
- Backend update action accepts partial (email-only) PUT bodies
- Works inside Frame navigation (`rmx-target="client-grid"`)
- CSRF-protected

**Non-Goals:**

- Other columns (name, role, status) — email only for now
- Optimistic UI with rollback — show saving indicator, reload on success
- Drag/resize or other complex interactions
- No new route or endpoint — reuse existing PUT `/client/:id`

## Decisions

1. **Single clientEntry with delegation** — following the `AdminResourcesContextMenu` pattern. A single `ClientGridInlineEdit` component attaches a click delegation listener on the table container. When a `.js-inline-edit` cell is clicked, it sets `editingId` + `editValue` in setup scope state and calls `handle.update()`. The render function reads these and returns `<input>` instead of text for the active cell.

2. **Map-based edit state** — `editingId: number | null`, `editValue: string`, `savingId: number | null`. No `Map<id, state>` needed since only one cell can be editing at a time (simpler than full multi-cell editing for this prototype).

3. **Save via fetch PUT** — on Enter or blur, the component sends `PUT /client/:id` with JSON `{ email: newValue }` and `X-Csrf-Token` header. The existing controller `update` action already handles full-object saves; we extend it to accept partial bodies.

4. **Reload on success** — after successful save, call `handle.frame.reload()` to refresh the grid. This keeps data consistent (server is source of truth) and matches the existing appointment grid pattern.

5. **Serialized grid state** — a `<script id="client-grid-state" type="application/json">` block renders the current `offset`, `sort`, `order`, `filter`, and `csrfToken` for the component to read.

## Risks / Trade-offs

- [Full page reload on save] → Frame reload via `handle.frame.reload()` avoids a hard navigation; user sees the grid refresh in-place
- [CSRF token in JSON] → Store in a `<meta>` tag (already present) or the JSON block; component reads it there
- [Concurrent edits] → Only one cell editable at a time; clicking another first commits or cancels the current edit
- [Empty/invalid email on save] → Server validates and returns 400; component shows a brief inline error below the input
