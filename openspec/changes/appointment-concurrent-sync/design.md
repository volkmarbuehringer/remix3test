## Context

The appointments table uses a PostgreSQL exclusion constraint `EXCLUDE USING GIST (date WITH =, during WITH &&)` to prevent overlapping time slots. When a write violates this constraint, PostgreSQL throws error code `23P01` (`exclusion_violation`). Currently, this error propagates as an unhandled exception in the controller, resulting in a 500 response with a raw PostgreSQL error message.

Additionally, there is no cross-session awareness — if user A creates an appointment, user B's open page shows stale data until they manually refresh.

The project already has SSE infrastructure (`createChannel<EventMap>()` in `app/lib/sse-channel.ts`) used by the messaging feature. This can be reused for appointment sync.

## Goals / Non-Goals

**Goals:**
- Catch PostgreSQL `23P01` exclusion violations in create/update actions
- Return a structured JSON error `{ error: "Time slot already taken.", code: "collision" }` with status 409 Conflict
- Client-side: when receiving a collision error, reload the page to show the blocking appointment
- Create an SSE channel for appointment invalidation events
- Broadcast `invalidate` on successful create/update/delete
- Client-side: subscribe to the SSE channel, reload page on invalidation from other sessions
- All behaviors gated behind existing auth middleware

**Non-Goals:**
- No changes to the SSE infrastructure itself
- No optimistic UI or in-place update — page reload is sufficient for this stage
- No retry logic for failed writes — the user sees the collision and the refreshed page
- No changes to appoint type CRUD

## Decisions

### Decision 1: Catch the PostgreSQL error by code in the data layer

- **Chosen**: Detect the exclusion constraint violation in the data layer (`appointments.ts`) by catching `DatabaseError` and checking `code === '23P01'`, then throwing a typed `AppointmentCollisionError`.
- **Alternatives considered**:
  - Catch in the controller: Couples the controller to PostgreSQL-specific error codes.
  - Catch in the schema's `validate` hook: Validation runs before the query, can't detect constraint violations at the DB level.
  - Use `ON CONFLICT DO NOTHING`/`ON CONFLICT DO UPDATE`: Not applicable — exclusion constraints aren't supported by `ON CONFLICT`.
- **Rationale**: The data layer is the right abstraction boundary. The controller works with domain errors (`AppointmentCollisionError`), not raw PostgreSQL error codes.

### Decision 2: SSE for cross-session sync via page reload

- **Chosen**: Create a typed channel `appointmentChannel = createChannel<{invalidate: void}>()`. Broadcast `invalidate` after each successful write. The appointment page subscribes via `<Frame>` or inline SSE and reloads on the event.
- **Alternatives considered**:
  - WebSocket: More complex setup, overkill for one-directional invalidation.
  - Polling: Simpler but wastes resources. SSE is push-based and efficient.
  - Short polling with `setInterval`: No infrastructure needed but high latency vs resource tradeoff. SSE is already available.
- **Rationale**: SSE infrastructure already exists and is proven. A dedicated channel for appointments is a single line. Page reload is simple and ensures consistency.

### Decision 3: 409 Conflict status code

- **Chosen**: Return HTTP 409 Conflict for collision errors.
- **Alternatives considered**:
  - 400 Bad Request: Implies malformed input, not a conflict with existing state.
  - 422 Unprocessable Entity: Valid semantically but less standard for resource conflicts.
  - 200 with error flag: Confusing — successful status code with error response body.
- **Rationale**: HTTP 409 Conflict is the standard status for resource conflicts (RFC 7231). It clearly signals that the request conflicts with the current state of the resource.

### Decision 4: Full page reload vs. in-place update

- **Chosen**: Full page reload (`window.location.reload()`) on collision and SSE invalidation.
- **Alternatives considered**:
  - Fetch updated data and re-render: More seamless UX but more complex — would need to update the grid state, layout solver, and preview state without losing the user's scroll position or interaction state.
  - Patch the grid with the blocked slot: Too error-prone — other sessions may have made multiple overlapping changes.
- **Rationale**: Page reload is simple, guarantees consistency, and avoids complex state reconciliation. For a calendar app, the reload cost is minimal (data is cached server-side).

## Risks / Trade-offs

- **[Page reload UX]** A full page reload on SSE invalidation may be jarring if the user is mid-interaction. Mitigation: debounce SSE events (e.g., coalesce within 500ms) and only reload if no active gesture or draft is in progress.
- **[SSE connection limits]** Each open tab creates an SSE connection. Browsers limit concurrent connections per domain (typically 6). Mitigation: the appointment SSE channel is only subscribed when on the appointment page, and the connection closes when navigating away.
- **[Error code fragility]** PostgreSQL error codes are generally stable across versions, but checking a specific code couples the data layer to PostgreSQL. Mitigation: the `23P01` code has been stable since PostgreSQL 9.2. If the app ever migrates away from PostgreSQL, this check would be part of the adapter layer changes.
