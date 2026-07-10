## Why

The `/appointments` page automatically refreshes when appointments change (via SSE), keeping users in sync across sessions. The `/admin/appointments` page lacks this capability — admins must manually reload to see changes made by other users or sessions. This leads to stale data and confusion.

Adding SSE-based auto-refresh to the admin appointments page brings it to parity with the user-facing page and ensures admins always see the latest appointment data without manual intervention.

## What Changes

- Add an `events` SSE endpoint to the admin appointments controller that subscribes to the existing `appointmentChannel`
- Inject a client-side SSE script in the admin appointments page that listens for `invalidate` events and reloads the frame content
- Broadcast `invalidate` events from admin appointment mutations (create, update, destroy) so admin-initiated changes also keep other sessions in sync
- Suppress auto-refresh when the admin is actively editing or creating an appointment (same pattern as `/appointments`)
- Add a shared interaction state tracker for the admin appointments page (similar to `appointment-interaction-state.ts`)

## Capabilities

### New Capabilities

- `admin-appointments-sse`: SSE-based auto-refresh for the admin appointments page, including event subscription, client-side reload logic, and mutation broadcasting

### Modified Capabilities

_(No existing capability requirements are changing — the admin appointments page simply gains a new capability)_

## Impact

- **Admin appointments controller** (`admin-appointments-controller.tsx`): Add `events` action subscribing to `appointmentChannel`; add `broadcast('invalidate')` calls after create/update/destroy
- **Admin appointments page** (`admin-appointments-page.tsx`): Add embedded client script or modify `AdminAppointmentsContextMenu` to subscribe to SSE and reload on invalidation
- **Routes** (`routes.ts`): Add `events: get('/events')` to the admin appointments route
- **No new dependencies** — reuses existing `appointmentChannel` and SSE infrastructure
- **No breaking changes** — existing admin functionality, forms, and navigation remain unchanged

Created: `proposal.md`
