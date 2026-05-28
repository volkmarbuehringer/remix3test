## Context

The app currently has no calendar or schedule feature. The Timeboxer demo implements a polished weekly schedule grid with drag-and-drop, inline editing, and sidebar navigation. This design adapts that pattern for newapp — replacing named schedules with date-based weekly navigation and dropping the ICS export.

The existing app patterns to follow:
- Auth'd routes use `requireAuth()` middleware (see `lists-controller.tsx`)
- Sidebar layouts use the `createSidebarLayout` factory (see admin and AI routes)
- Frame-based navigation uses `X-Remix-Frame` headers for sidebar content
- Data layer uses `remix/data-table` with PostgreSQL adapter (auto-creates tables on startup)

## Goals / Non-Goals

**Goals:**
- Add `appointments` table to the database schema
- Create `/appointment` route with auth middleware
- Build a weekly calendar grid showing 7 columns (Mon–Sun) × time slots
- Implement sidebar with year (2026–2030) and week number dropdowns
- Support full CRUD: create (click empty slot), read (display blocks), update (drag/resize/inline edit), delete (sidebar button)
- Add "Appointment" link to main nav

**Non-Goals:**
- No ICS/calendar export
- No priority or color fields on appointments
- No recurring events — each appointment is a single date-based block
- No shared calendars or multi-user scheduling
- No push notifications or reminders

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Flat model vs named schedules** | Flat (all appointments by date) | Week picker replaces schedule names. Simpler schema, no name management. |
| **Date storage** | `column.timestamp()` set to midnight of the target date | Maps to actual dates, not day-of-week. Enables shifting dates when changing years. |
| **Sidebar pattern** | Frame-based sidebar (same as admin/AI) | Consistent with existing app architecture. Sidebar contains year/week pickers + nav. |
| **Week grid** | `clientEntry()` from the start — even basic click-to-create needs client JS | Grid uses `clientEntry()` for Phase 1 (create, rename, delete). Phase 2 adds drag-and-drop + resize on top of the same component. |
| **Year range** 2026–2030 | Hardcoded for now | Simple, focused scope. Can be widened later. Defaults to current year. |
| **Week numbering** | Standard ISO week (Mon–Sun) | Matches week number convention users expect. |
| **Block colors** | Hash-based from title (like Timeboxer) | No user-configurable color. Same name = same color. Zero UI overhead. |
| **API format** | JSON endpoints for CRUD, matching Timeboxer pattern | Consistent with existing pattern. Client sends JSON, server responds with JSON. |

## Risks / Trade-offs

- **[Low] Block time collisions**: Two blocks can overlap in the same time slot. The Timeboxer layout solver handles this automatically with cost-based resolution. Minimal risk — layout solver is a pure function.
- **[Low] Date shifting across years**: If user creates appointments in 2026 and switches to 2027, the grid shows those same dates but now in 2027. This is expected behavior for a flat date model.
- **[Low] Large data volume**: Over time, users might accumulate many old appointments. Mitigation: the grid only loads the current week's data, so query scope is inherently bounded.
- **[None] Performance**: The layout solver is O(n²) in the worst case, but realistic grids have <20 blocks per week.
