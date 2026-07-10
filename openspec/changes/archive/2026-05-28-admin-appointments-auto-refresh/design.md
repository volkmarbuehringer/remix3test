## Context

The `/appointments` page uses SSE (Server-Sent Events) via the existing `appointmentChannel` to automatically refresh when appointments change. The admin appointments page (`/admin/appointments`) does not — admins must manually reload to see changes made by other sessions. The SSE infrastructure (`createChannel`, `appointmentChannel`) already exists and is proven in production.

The admin page is server-rendered with frame-based navigation (`rmx-target`), uses direct SQL for CRUD operations (not the `data/appointments.ts` helpers), and has a `clientEntry` for its context menu. The `/appointments` page uses a full `clientEntry` (`AppointmentGrid`) that handles both the grid rendering and SSE subscription.

## Goals / Non-Goals

**Goals:**

- Admin appointments page auto-refreshes when appointments change (same invalidation event as `/appointments`)
- Admin-initiated mutations (create/update/delete) broadcast invalidation to other sessions
- No auto-refresh while the admin is actively editing or creating an appointment
- Reuse existing `appointmentChannel` and SSE infrastructure — no new channels or dependencies

**Non-Goals:**

- Not changing the `/appointments` page behavior
- Not adding SSE to other admin pages (scope is limited to appointments)
- Not changing the admin page's UI or form behavior
- Not adding drag/resize or other interactive features to the admin page

## Decisions

**Decision 1: Reuse existing `appointmentChannel`**

- **Chosen:** Use the same `appointmentChannel` that `/appointments` uses
- **Rationale:** The channel already broadcasts `invalidate` events on mutations. Both pages need the same event (reload when any appointment changes). A single channel means all browsers (user-facing and admin) receive the invalidation simultaneously.
- **Alternatives considered:**
  - Create a separate `adminAppointmentChannel` — unnecessary duplication, no isolation benefit
  - Use the channel with `{ source: 'admin' }` payload — adds complexity without value

**Decision 2: Client-side SSE via embedded `<script>`**

- **Chosen:** Add a small `<script>` block in `AdminAppointmentsPage` that creates an `EventSource`
- **Rationale:** Unlike `/appointments` which has a full client entry (`AppointmentGrid`), the admin page is primarily server-rendered. Adding SSE via a lightweight script avoids promoting the context menu `clientEntry` to handle concerns outside its scope (grid state → SSE). The script is <20 lines and easy to understand.
- **Alternatives considered:**
  - Add SSE to `AdminAppointmentsContextMenu` — tightly couples menu logic with data refresh, confusing scope
  - Create a new `clientEntry` for the admin appointments page — heavier than needed

**Decision 3: Interaction guard via URL check (no shared state module)**

- **Chosen:** Check `URLSearchParams` for `editing` or `creating` params before reloading
- **Rationale:** The admin page uses URL params (`?editing=123`, `?creating=true`) to persist editing state across page loads. This is inherently reliable — as long as these params are present, the user is in an edit/create flow. When they save/cancel, the server redirects without these params, making SSE invalidations effective again.
- **Alternatives considered:**
  - Create `adminAppointmentsInteractionState` module — adds a file and import for a 3-line guard
  - DOM check for active forms — more fragile, race conditions with frame navigation

**Decision 4: Broadcast invalidation after admin mutations**

- **Chosen:** Add `appointmentChannel.broadcast('invalidate')` after each create/update/destroy action
- **Rationale:** The admin controller does direct SQL (bypassing `data/appointments.ts` helpers), so mutations don't automatically trigger the existing `broadcast` calls in the appointment controller. Adding explicit broadcasts keeps both pages in sync regardless of where the change originated.

## Risks / Trade-offs

- **[Behavioral] Admin page reloads slightly more often**: Admin users will see the table refresh when other users make appointments. This is the desired behavior but may be surprising at first. Mitigation: the reload is instant and preserves scroll position... actually, `window.location.reload()` will scroll to top. For a table with pagination, this is acceptable since the pagination state is in the URL and will be preserved.
- **[Interaction] In-flight form submission interrupted**: If the user submits an edit form and the server redirects, and before the redirect completes an SSE invalidation fires, the page could reload mid-redirect. Mitigation: the server redirect is a 302 which the SSE reload shouldn't interfere with (fetch-based form submission vs EventSource). Any SSE event that arrives during navigation is a no-op.
- **[Performance] Additional SSE connections**: Each admin tab adds one SSE connection. This is negligible — the existing infrastructure handles it.

Created: `design.md`
