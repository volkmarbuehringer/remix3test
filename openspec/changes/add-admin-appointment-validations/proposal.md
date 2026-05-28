## Why

The admin appointments panel at `/admin/appointments` bypasses business logic that the regular `/appointments` endpoint enforces: it does **not** verify that the requested time slot falls within an offering configured for that resource and day. This means admins can (and the current form allows) create appointments at arbitrary times regardless of whether the resource is actually available for booking. The collision check via PostgreSQL exclusion constraint exists, but offering validation is entirely missing — creating a gap between admin and user-facing booking rules.

## What Changes

- Add `isSlotBookable()` check to the admin controller's **create** action — reject creation if no offering exists for the requested time range
- Add `isSlotBookable()` check to the admin controller's **update** action — reject update if the changed slot has no offering
- Add integration tests in `admin-appointments-controller.test.ts` for both offering-availability and collision scenarios

## Capabilities

### New Capabilities
*(none — this adds validation to an existing capability)*

### Modified Capabilities
- `admin-appointments`: New requirement — admin appointment creation and updates MUST validate that the requested time range is covered by an offering for the resource/day

## Impact

- **Controller**: `admin-appointments-controller.tsx` — add `isSlotBookable()` import and calls in create/update actions
- **Tests**: `admin-appointments-controller.test.ts` — add test cases for offering validation and collision scenarios
- **No schema changes**: offering data (`appointoffering` table) already exists and `isSlotBookable()` is a shared utility
