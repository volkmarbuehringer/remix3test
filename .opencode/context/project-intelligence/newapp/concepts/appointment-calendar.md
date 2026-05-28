<!-- Context: project-intelligence/newapp/concepts/appointment-calendar | Priority: high | Version: 1.2 | Updated: 2026-05-25 -->

# Concept: Appointment Calendar Architecture

**Core Idea**: Auth-protected weekly calendar at `/appointment` with its own controller, data layer, and client-hydrated grid. Uses server-embedded JSON for data passing and JSON fetch API for mutations. All mutations trigger `window.location.reload()` (Phase 1 limitation — no Frame-based fragment swapping).

---

## File Layout

```
app/
  routes.ts                   → appointmentRoutes nested route tree
  router.ts                   → router.map(wires to appointmentController)
  data/
    schema.ts                 → appointments table (BIGINT date, afterRead conversion)
    appointments.ts           → Data functions (listByWeek, create, update, delete)
  actions/
    appointment-controller.tsx → createController with requireAuth, 4 actions
  ui/
    schedule-layout.ts        → Pure-function layout solver for collision resolution (Phase 2)
    appointment-page.tsx      → Layout shell: sidebar + grid shell via gridTemplateColumns
    appointment-grid.tsx      → clientEntry: weekly grid with click/dblclick/drag/resize (1518 lines)
    appointment-sidebar.tsx   → clientEntry: year/week dropdown pickers
```

## Route Wiring

```tsx
// app/routes.ts — separate route tree with own controller
export const appointmentRoutes = route({
  appointment: route('appointment', {
    index: get('/'),         // GET  /appointment
    create: post('/'),       // POST /appointment
    update: put('/:id'),     // PUT  /appointment/:id
    destroy: del('/:id'),    // DEL  /appointment/:id
  }),
})
```

Wired in `app/router.ts` via `router.map(appointmentRoutes.appointment, appointmentController)`.

## Controller Differences from Client Lab

| Aspect | Client Lab (`remix/fetch-router`) | Appointment (`remix/router`) |
|--------|-----------------------------------|------------------------------|
| Import | `createController` from `remix/fetch-router` | `createController` from `remix/router` |
| Context | Context-property destructuring e.g. `{ db, render }` | Direct `context.db`, `context.auth`, `context.url` |
| Responses | Mixed (HTML renders + form redirects) | All JSON (`Response.json()`) |
| Fragment rendering | Frame-based grid fragment | No frames — single page |

## Controller Actions

| Action | Method | Body | Response |
|--------|--------|------|----------|
| `index` | GET | — | HTML page render with server-embedded JSON |
| `create` | POST | `{ title, date, start_min, end_min }` | `201 { appointment }` or `400` |
| `update` | PUT | `{ title }` (partial) | `200 { appointment }` or `404` |
| `destroy` | DELETE | — | `200 { deleted: true }` or `404` |

The `index` action computes week start from `year`/`week` query params, clamped to valid ranges (2026–2030, weeks 1–52). Week boundaries use ISO week number calculation (January 4th rule) with epoch-ms Monday midnight values.

### Client Interaction Notes

The grid uses two interaction patterns that are documented separately:

- **Inline rename via textarea** — Double-click opens a `<textarea rows={2}>` for multiline title editing; `Shift+Enter` or Save button commits (PUT), blur or Escape or Cancel button cancels (discards). Save + Cancel buttons use `pointerdown` to avoid the blur-before-click race. Focus uses `requestAnimationFrame`. See the [Inline Rename guide](../guides/inline-rename-pattern.md).
- **Manual double-click detection** — Native `dblclick` is suppressed by the drag system's `preventDefault()` on `pointerdown`. Manual timing-based detection routes rapid `pointerdown` pairs to `startEdit()`. See the [Manual Double-Click Detection concept](../concepts/manual-doubleclick-detection.md).

### Grid Constants & 15-Minute Snap

The grid uses a 4× scale factor so 15-minute blocks have the same visual density as the old 1-hour blocks:

| Constant | Value | Purpose |
|----------|-------|---------|
| `SLOT_HEIGHT` | 160 | Pixels per hour (4× scale, 15min = 40px) |
| `SUB_SLOTS` | 4 | Quarter-hour subdivisions per hour |
| `SUB_SLOT_HEIGHT` | 40 | Pixels per 15-min slot (`SLOT_HEIGHT / SUB_SLOTS`) |
| `HOURS * SUB_SLOTS` | 96 | Total quarter-hour rows in the grid |
| `MINIMUM_DURATION` | 15 | Server-side minimum appointment duration (minutes) |

All pointer-to-minute snap conversions use `Math.round(rawMinute / 15) * 15` — 15-min granularity for drag, resize, type-drag, and draft creation. The last valid snap is `24 * 60 - 15 = 1425` (23:45). See the [Layout Solver](../../development/remix3/guides/layout-solver.md) and [Drag & Resize Gestures](../../development/remix3/guides/drag-resize-gestures.md) guides for the full snap mechanics.

**Server-side validation**: The controller's `create` and `update` actions both validate `end_min - start_min >= 15`. The type-drag raw SQL path uses `int4range($2, $2 + 15, '[)')`. See [Appointment CRUD Guide](../guides/appointment-crud.md) for details.

### Visual Grid Structure

The grid renders 96 rows per day column with distinct visual treatment:
- **Hour marks** (slot % 4 === 0): solid border-top lines, `:00` time labels
- **Half-hour marks** (slot % 4 === 2): dashed border-top lines, faded `:30` labels
- **Quarter-hour marks** (slot % 4 === 1 or 3): dashed border-top lines, no labels

Block heights are purely proportional: `(duration / 60) * SLOT_HEIGHT`. No non-editing minimum. Only editing blocks enforce an 84px minimum (to contain textarea + buttons).

## Layout Integration

The appointment page nests inside the main `<Layout>` but overrides the content area with its own grid shell:

```
Layout (title="Appointment")
  <script id="appointment-data" type="application/json">  ← server-embedded data
  div shellStyle (display: grid; gridTemplateColumns: '240px 1fr')
    AppointmentSidebar     ← position: sticky; top: theme.space.lg
      <select year> <select week>  ← on('change') → navigate()
    div contentStyle (minWidth: 0)
      AppointmentGrid      ← clientEntry: grid with sticky header
```

**Sticky behavior**: Sidebar sticks at `theme.space.lg` below the `<Layout>` header. Grid header sticks at `top: 0` inside its overflow container (`pageStyle` has `overflowY: auto`). `minWidth: 0` on content wrapper prevents grid blowout.

## Data Layer

Week-range queries use `gte()` / `lt()` comparison operators from `remix/data-table`. Ownership isolation via `user_id` on every query. Custom `AppointmentError` class with `status` field for 404 responses. See the [CRUD guide](../guides/appointment-crud.md) for full schema, query patterns, validation, and error handling.

## Server-Embedded JSON

Single `<script id="appointment-data">` tag carries all page state: `year`, `week`, `weekStart`, `days`, `appointments`, `csrfToken`. Both the grid and sidebar client entries read from this tag during render via `readData()`.

## Mutation Strategy

All mutations use `fetch()` with JSON body and `X-Csrf-Token` header. On success, the page calls `window.location.reload()`. No Frame-based fragment swapping, no inline update, no optimistic rendering.

| Operation | HTTP | Reload? | Notes |
|-----------|------|---------|-------|
| Create | POST | ✅ | Single block — min 15-min duration enforced server-side |
| Rename | PUT | ✅ | Single block — title only via textarea; Shift+Enter/Save button commits; blur/Escape/Cancel button cancels |
| Delete (drag-to-trashcan) | DELETE | ✅ | Single block — triggered by dropping dragged block on trashcan in header |
| Drag to move | PUT | ✅ | Batch — may update multiple blocks if collision solver shifted neighbors |
| Resize | PUT | ✅ | Batch — min 15-min duration enforced server-side and by layout solver; end-edge offsetY relative to `end_min` |

Phase 2 (drag/resize) added **batch PUT**: the collision solver (`schedule-layout.ts`) may shift multiple blocks during resolution. All changed blocks are saved with parallel `fetch()` calls on drop/release, followed by a single reload.

Phase 2 (drag/resize) added **batch PUT**: the collision solver (`schedule-layout.ts`) may shift multiple blocks during resolution. All changed blocks are saved with parallel `fetch()` calls on drop/release, followed by a single reload.

## Nav Integration

Registered in `app/ui/nav.ts` under "Pages" section: `{ label: 'Appointment', href: '/appointment' }`.

## 📂 Codebase References

| File | Purpose |
|------|---------|
| `app/routes.ts` | `appointmentRoutes` definition (lines 37-44) |
| `app/router.ts` | Route-to-controller wiring (line 80) |
| `app/actions/appointment-controller.tsx` | Controller: index, create, update, destroy |
| `app/data/appointments.ts` | Data functions + AppointmentError |
| `app/data/schema.ts` | `appointments` table (lines 286-320) |
| `app/ui/appointment-page.tsx` | Layout shell with sidebar+grid gridTemplateColumns |
| `app/ui/schedule-layout.ts` | Pure-function layout solver — collision resolution for drag/resize |
| `app/ui/appointment-grid.tsx` | clientEntry: weekly grid with click, textarea rename, manual dblclick detection, drag, resize |
| `app/ui/appointment-sidebar.tsx` | clientEntry: year/week pickers |
| `app/ui/nav.ts` | Nav entry (line 29) |

## Related

- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer, validation, ownership isolation
- [Inline Rename Pattern](../guides/inline-rename-pattern.md) — Textarea-based inline title editing with Shift+Enter commit
- [Manual Double-Click Detection](../concepts/manual-doubleclick-detection.md) — Workaround for pointerdown+preventDefault dblclick suppression
- [Weekly Grid Pattern](../../development/remix3/guides/appointment-grid.md) — CSS grid layout, sticky headers, event handling, drag/resize
- [Drag & Resize Gestures](../../development/remix3/guides/drag-resize-gestures.md) — Closure-based gesture state machine (Phase 2)
- [Drag-to-Trashcan Guide](../guides/drag-to-trashcan.md) — Delete by dragging onto trashcan in header corner cell
- [Layout Solver](../../development/remix3/guides/layout-solver.md) — Pure-function collision resolution (Phase 2)
- [clientEntry Hash Fragment Pattern](../guides/client-entry-pattern.md) — Used by both grid and sidebar
- [Flat Controller Pattern](../guides/flat-controller-pattern.md) — Separate controller per route pattern
- [Known Issues](../lookup/known-issues.md) — Scrollbar interaction, hardcoded year range, page reload UX
