## Context

The application stores appointments and offerings with day-level dates as epoch milliseconds in UTC (e.g., January 15, 2026 → `1760659200000`). Currently there is no validation preventing users or admins from creating or modifying these records with dates in the past. The `appointments` table has a `date` (bigint) column and `start_min`/`end_min` (int) computed columns from the `during` int4range. The `appointoffering` table has a `day` (bigint) column and a `during` int4range.

Existing validation (schema-level and controller-level) covers format, range bounds, overlap prevention, and holiday checks — but not past-date rejection.

## Goals / Non-Goals

**Goals:**
- Prevent creation of appointments and offerings with dates in the past
- Prevent updating (modifying) appointments and offerings with dates in the past
- Allow deletion of past records only for admin users; deny for non-admin users
- Provide clear German-language error messages consistent with existing patterns
- Enforce validation at the data-access layer for consistency across all access paths
- Cover both the user-facing appointment calendar and admin appointment/offering management

**Non-Goals:**
- Not modifying the database schema (no new columns, no new constraints)
- Not adding a soft-delete mechanism — deletion remains hard DELETE
- Not backfilling or cleaning up existing past records
- Not changing authentication or authorization middleware
- Not modifying appointment types (`appointtypes`) — they have no date field and are not time-bound
- Not adding timezone conversion — dates are already stored as UTC epoch ms, comparison is against server UTC time

## Decisions

### 1. Enforce at data-access layer (DAL), not controller level

**Decision**: Add past-date validation in `data/appointments.ts` and `data/appointofferings.ts`, inside `createAppointment`, `updateAppointment`, and equivalent offering functions.

**Rationale**:
- Both user-facing and admin controllers call the same DAL functions, so one enforcement point covers both.
- Schema-level `validate` hooks in `schema.ts` would be too low-level — they lack context about which operation (create/update/delete) is being performed and who the user is.
- Controller-level enforcement would require duplicating logic across multiple controllers.

**Alternative considered**: Schema-level `validate` hooks — rejected because they can't distinguish between create/update/delete operations or know about admin bypass.

### 2. Explicit `adminBypass` flag for past deletion

**Decision**: DAL functions accept an optional `{ adminBypass?: boolean }` options parameter. When `adminBypass: true`, past-date deletion is allowed. Only admin controllers pass this flag.

**Rationale**:
- Keeps the DAL pure and testable — no coupling to auth middleware or session context.
- Admin controllers already have `requireAdmin()` middleware, so by the time they call the DAL, the user is confirmed admin. The `adminBypass` flag is a second line of defense.
- Makes the authorization boundary explicit in the function signature — impossible to accidentally allow past deletion.

**Alternative considered**: Passing the full `Auth` context — rejected because it couples the DAL to the auth middleware and complicates testing.

### 3. Comparison: server UTC midnight vs. today

**Decision**: Compare `date`/`day` (epoch ms) against the start of today in UTC (`Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())`). If `date < todayUtcMidnight`, the record is in the past.

**Rationale**:
- Dates are stored as UTC midnight epoch ms — no timezone ambiguity.
- An appointment on "today" is not in the past, even if the time slot has already passed. This matches user expectations — you might want to book a same-day slot that hasn't started yet.
- No need to compare `during` time ranges against current time — only the day matters.

**Edge case**: If an appointment's date is today, creation/update is always allowed regardless of whether the time slot has already passed. This is intentional — the time slot (during range) may still have remaining time, and the business rule is about day, not minute-level precision.

### 4. Error response format

**Decision**: Return `AppointmentError` and `OfferingError` instances (matching existing patterns in `data/appointments.ts` and `data/appointofferings.ts`) with German messages.

**Message examples**:
- Create/update past appointment: `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- Delete past appointment (non-admin): `"Termine in der Vergangenheit können nur von Administratoren gelöscht werden."`
- Create/update past offering: `"Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- Delete past offering (non-admin): `"Angebote in der Vergangenheit können nur von Administratoren gelöscht werden."`

### 5. Unit of work: DAL returns errors, controllers handle HTTP responses

**Decision**: DAL functions return `AppointmentError | AppointmentCollisionError` (etc.) on validation failure. Controllers check the result and return appropriate HTTP responses (422 with error message, or form validation error).

**Rationale**: Consistent with the existing architecture — `AppointmentError` and `OfferingError` (or equivalents) are already used for other validation failures.

## Risks / Trade-offs

- **Risk**: Existing past records will remain in the database — no cleanup is performed.
  → **Mitigation**: This is intentional. The guardrail applies only to new writes. Existing data stays as-is. Admins can delete past records if needed.

- **Risk**: Race condition — a record created just before midnight might have a next-day date, while a record created just after midnight might have a previous-day date.
  → **Mitigation**: Acceptable. The boundary at midnight UTC is clear and consistent. Any book-around-the-clock scenario is on the order of milliseconds and unlikely to cause issues in practice.

- **Risk**: Same-day time slots that have already passed can still be created/modified.
  → **Mitigation**: This is a deliberate product decision. The constraint is "day past", not "time past". If finer-grained control is needed later, it can be added by comparing `during` end_min against current minutes-since-midnight.

- **Trade-off**: Adding validation at the DAL layer means the DAL needs knowledge of the current time, making it slightly less pure.
  → **Accept**: The DAL already uses `Date.now()` for `created_at`/`updated_at` timestamps, so this is not a new dependency.

- **Trade-off**: The `adminBypass` flag is a simple boolean — if the admin controllers ever need finer-grained authorization, the flag approach may need to be revisited.
  → **Accept**: For the current scope, a boolean is sufficient and clean.
