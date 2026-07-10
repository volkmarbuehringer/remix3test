## Context

The `/appointments/new` route currently blocks non-admin users from deleting appointments whose start time is less than 24h from now. This was implemented in the `appointments-new-24h-cancellation-policy` change. However, users who create an appointment and then immediately change their mind cannot delete it if the appointment's start time is within 24h — a common scenario for last-minute bookings.

The `appointments` table has a `created_at` column (BIGINT epoch ms) that records when each appointment was created. The destroy action currently only selects `date` and `start_min` from the row.

## Goals / Non-Goals

**Goals:**

- Allow non-admin users to delete appointments created less than 10 minutes ago, even if the start time is within 24h
- Preserve the 24h start-time restriction for older appointments (>10 min since creation)
- Preserve admin bypass (admins always can delete)
- Update the UI's `blocked` flag in the data loader to reflect the grace period

**Non-Goals:**

- No changes to the create action
- No email notifications or cancellation fees
- No changes to the admin `verwaltung/appointments` controller

## Decisions

1. **Inline the 10-minute check** — No new utility function needed. Use `Date.now() - Number(row.created_at) < 10 * 60 * 1000` directly in the destroy action's guard condition and the data loader's `blocked` computation.

2. **Fetch `created_at` in the existing query** — The destroy action's `SELECT` already fetches the row. Add `created_at` to it. The data loader's grid row query also returns `date` and `start_min`; add `created_at` there too for `blocked` computation.

3. **Modified guard logic** — The new condition in `destroy`:

   ```
   if (!isWithinHours(appointmentStartMs, 24) &&
       !(Date.now() - Number(row.created_at) < 10 * 60 * 1000) &&
       (auth.identity as { role: string }).role !== 'admin') {
   ```

   Block if: start < 24h away AND not within grace period AND not admin.

4. **Grace period counts from creation time** — `created_at` is set when the INSERT runs, so the 10-minute window starts when the appointment is persisted.

## Risks / Trade-offs

1. **Clock drift** — The check uses server `Date.now()`, so client clock skew is irrelevant.
2. **Race condition** — If a user creates an appointment and the server takes >10 minutes to respond (unlikely), the grace period could expire before the redirect completes. Negligible risk.
