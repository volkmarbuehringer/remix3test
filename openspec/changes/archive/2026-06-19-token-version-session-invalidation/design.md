## Context

Session auth data currently stores only `{ userId: number }`. On each request, the auth middleware's `verify()` checks that the user exists and `email_verified = 1` — but never ties the session to a specific password state. This means password changes (reset via email, change in settings, admin-forced change) don't invalidate existing sessions on other devices.

The data-table ORM doesn't support raw SQL expressions in update values (always `SET col = $N`), so the increment must be done client-side by reading the current value first.

## Goals / Non-Goals

**Goals:**

- Add `token_version` INTEGER column to `users` table, default 1
- Store `token_version` in session auth data at login: `{ userId, tv }`
- Auth `verify()` rejects sessions whose `tv` doesn't match the user's current `token_version`
- All four password-change paths (reset, settings, admin update, admin create) increment `token_version`
- Password reset handler also calls `session.regenerateId(true)` (currently missing)
- Settings password change re-issues auth with new `tv` so the current device isn't logged out

**Non-Goals:**

- Not implementing a full session-revocation list or JWT blacklist
- Not adding a `password_changed_at` timestamp (covered by the version counter)
- Not changing the admin user management destroy path (deletion already cleans up)

## Decisions

1. **Client-side increment over raw SQL** — The data-table adapter always uses parameterized `SET col = $N`. Reading current tv and writing tv+1 avoids bypassing hooks. The race window is microseconds and the consequence (extra invalidation) is strictly more secure.

2. **Integer version counter over timestamp** — Simpler to compare (no parsing), no clock-sync issues, trivially incrementable. Timestamps would need session creation time stored alongside for comparison.

3. **Include tv in session auth data** — Zero extra storage, no schema changes to session store. The auth data is already per-session so each device naturally has its own tv.

4. **Re-issue auth on settings password change** — User who initiates the change on their own device should stay logged in. The new tv is read back from DB after update, then `session.set('auth', { userId, tv: newTv })`.

## Risks / Trade-offs

- [Race condition] Two password changes at the exact same millisecond could use the same tv. Consequence: both read tv=3, both write tv=4. Session that logged in between the two writes would have tv=4 but the DB ends at tv=4. No actual harm.
- [Admin changes] Admin updating a user's password increments tv, logging out all that user's sessions. The admin's own session is unaffected. This is the intended behavior.
- [Existing sessions] All existing sessions have `auth: { userId }` without `tv`. The `verify()` must treat missing `tv` as invalid (require re-login), which means all currently logged-in users will be logged out once deployed. This is a one-time event.

## Migration Plan

1. Add `token_version` column to users table (default 1)
2. Update existing sessions will have no `tv` in auth — treat as invalid, forcing re-login
3. Deploy schema migration, then code changes
