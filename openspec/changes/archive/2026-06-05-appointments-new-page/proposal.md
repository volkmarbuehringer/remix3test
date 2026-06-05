## Why

Administrators need a quick self-service appointment view where they can manage their own appointments without the full admin grid's complexity. The current `/verwaltung/appointments` page is cluttered with admin-only columns (email, timestamps) and uses a right-click context menu that is not mobile-friendly.

## What Changes

- New route at `/appointments/new` (top-level, outside `/verwaltung/`) with `requireAuth()` middleware — accessible to all authenticated users, not just admins
- Simplified table view: columns reduced to ID, Titel, Ressource, Datum, Zeit — no E-Mail, Erstellt, or Aktualisiert columns
- Action buttons (Bearbeiten/Löschen) in each row instead of right-click context menu — works on mobile and desktop
- Form without Benutzer (user) field — appointments are created for the currently authenticated user automatically
- Reuses existing shared functions: `data/appointments.ts` (CRUD), `data/appointofferings.ts` (slot validation), `utils/appointment-schema.ts` (schema), `utils/grid-state.ts` (grid state), `lib/appointments-sse.ts` (SSE)
- No changes to existing `/verwaltung/appointments` — the admin page remains untouched

## Capabilities

### New Capabilities
- `appointments-new-page`: Simplified self-service appointments page at `/appointments/new` with reduced columns, inline action buttons, and no user selection in form

### Modified Capabilities

*(None — the existing admin appointments page is unchanged)*

## Impact

- **New files:**
  - `newapp/app/actions/appointments-new/controller.tsx` — simplified controller (no admin-only logic)
  - `newapp/app/ui/appointments-new-page.tsx` — simplified page component with action buttons
  - `newapp/app/ui/appointments-new-form.tsx` — form without user_id field
- **Modified files:**
  - `newapp/app/routes.ts` — add `/appointments/new` route tree
  - `newapp/app/router.ts` — map new route to new controller
- **Shared dependencies** (no changes, reused as-is):
  - `data/appointments.ts` — listAppointmentsByWeek, createAppointment, updateAppointment, deleteAppointment
  - `data/appointofferings.ts` — isSlotBookable, parseDuring
  - `utils/appointment-schema.ts` — form schema (possibly new variant without user_id)
  - `utils/grid-state.ts` — grid state helpers
  - `lib/appointments-sse.ts` — SSE channel
  - `ui/mixins/admin-table.ts` — table CSS mixins
  - `ui/mixins/admin-urls.ts` — URL building helpers
