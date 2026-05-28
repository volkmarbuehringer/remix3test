## Why

The appointments exclusion constraint (`no_overlapping_seats`) rejects concurrent writes that would create overlapping time slots, but the error bubbles up as a raw PostgreSQL error to the user. There is no cross-session synchronization — if two users book the same slot simultaneously, the second user gets a confusing error and has no way to see the current state without manually refreshing.

## What Changes

- **Controller error handling**: Catch PostgreSQL `23P01` exclusion constraint violations in the appointment create/update actions and return a user-friendly JSON error instead of a 500
- **Client-side refresh on collision**: When the client receives a collision error, it refreshes the page to show the latest appointment data (the blocking appointment is now visible)
- **SSE invalidation channel**: Create an appointment SSE channel that broadcasts an `invalidate` event whenever an appointment is created, updated, or deleted
- **Client SSE subscription**: The appointment page subscribes to the SSE channel and refreshes the page when an `invalidate` event is received from another session
- **No breaking changes**: The API contract for successful requests remains unchanged

## Capabilities

### New Capabilities

- *(none — leverages existing SSE infrastructure)*

### Modified Capabilities

- `appointment-calendar`: The create and update actions now handle exclusion constraint violations gracefully, returning a friendly error. The page auto-refreshes on collision and on external changes via SSE invalidation.

## Impact

- **`app/actions/appointment-controller.tsx`**: Catch `23P01` errors in create/update actions; broadcast SSE event on successful create/update/delete
- **`app/data/appointments.ts`**: Export a new `AppointmentCollisionError` class (or extend existing `AppointmentError`) for the controller to detect
- **`app/ui/appointment-grid.tsx``: Handle collision error responses by reloading the page
- **`app/ui/appointment-page.tsx`**: Subscribe to SSE invalidation channel, refresh on external changes
- **SSE**: No infrastructure changes needed — existing `createChannel()` is sufficient
