<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Guide: Inline Edit Panel via SSR Query Params

**Purpose**: Render an inline edit panel beside a frame-based grid using only SSR and query params — no client-side state, no modals, no second Frame.

## Core Idea

A `?editing=<rowId>` query param on the parent route controls whether the edit panel renders. The index handler reads `?editing=`, fetches the row, and passes it to a two-column layout (grid + edit panel). No `<Frame>` wraps the editor — it renders server-side on every navigation.

```
/client                     → grid only (default)
/client?editing=5&offset=40 → grid + inline edit panel for row 5
```

## Lifecycle

```
1. Click Edit → <a href="/client?editing=5&offset=...&sort=...&order=..." target="_top" rmx-document>
2. Full page nav → index handler reads ?editing= → fetches row → renders two-column layout
3. Form POST /client/save → save handler updates DB → 302 redirect to /client?editing=5&offset=...
4. After redirect → index handler rereads row → edit panel shows saved data
5. Click Cancel → <a href="/client?offset=..."> removes ?editing= → grid-only view
```

## Grid State Preservation

All grid state (offset, sort, order, filter) flows through the full lifecycle:

| Stage | Carries State |
|-------|--------------|
| Edit link | `buildEditUrl()` embeds all params in the URL |
| Hidden fields in form | `_offset`, `_sort`, `_order`, `_filter` on each form |
| Save redirect | Reads hidden fields, re-embeds in 302 `Location` |
| Cancel link | `cancelUrl()` builds grid-only URL with preserved state |

## Key Decisions

| Decision | Why |
|----------|-----|
| One edit component only | No standalone `/edit/:id` page. All editing happens inline. |
| No Frame for editor | Saves a Frame slot. Edit panel is SSR-only, no client hydration needed. |
| `rmx-document` for edit links | Navigation API intercepts anchor clicks inside Frames. `target="_top"` alone is not enough — use `rmx-document` to force full page navigation when switching between editing different rows. |
| `?editing=` preserved on save | User stays in editing context after save to verify changes. Cancel dismisses. |

## Example Flow

```tsx
// Controller (index handler): reads ?editing=, fetches row, renders two-column
let editingParam = context.url.searchParams.get('editing')
let editingRowId = editingParam ? Number(editingParam) : null
if (editingRowId && Number.isFinite(editingRowId)) {
  editRow = await db.find(clients, { id: editingRowId })
}
return context.render(
  <ClientPage
    frameSrc={frameSrc}         // grid Frame src
    editRow={editRow}           // null → grid-only, row → two-column
    editingOffset={String(offset)}
    editingSort={column}
    editingOrder={direction}
    editingFilter={filter}
  />
)

// Save handler: redirect preserves ?editing=
params.set('editing', String(rowNum))
// ... offset, sort, order, filter also set
return new Response(null, {
  status: 302,
  headers: { Location: '/client?' + params.toString() }
})
```

## Reference

- `controllers/client/controller.tsx` — index(), edit(), save(), destroy() handlers
- `controllers/client/page.tsx` — ClientPage two-column layout
- `controllers/client/edit-page.tsx` — inline edit panel component
- `controllers/client/grid-page.tsx` — grid with Edit buttons calling `buildEditUrl()`
