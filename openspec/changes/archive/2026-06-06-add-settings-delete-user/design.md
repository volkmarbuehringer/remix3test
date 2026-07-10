## Context

The settings page at `/settings` currently supports password changes via a single POST handler in `app/actions/settings/controller.tsx`. The route is defined as `form('settings')` in `app/routes.ts`, generating GET and POST at `/settings`. The controller uses `requireAuth()` middleware to ensure authentication.

The admin panel has an existing user deletion pattern in `app/actions/admin-users/controller.tsx` that prevents self-deletion (admin cannot delete own account). This new feature is for self-service deletion, which has different constraints: the user _should_ be able to delete themselves, then get logged out.

Database foreign key constraints on `users.id`:

- `messages.sender_id` → `ON DELETE RESTRICT` (blocks deletion)
- `workflow_runs.created_by` → no cascade (no action = restrict, blocks deletion)
- `appointments.user_id` → `ON DELETE CASCADE` (safe)
- `appointtypes.user_id` → `ON DELETE CASCADE` (safe)
- `chatlog.user_id` → `ON DELETE SET NULL` (safe)
- `audit_logs.admin_user_id` → `ON DELETE CASCADE` (safe)

## Goals / Non-Goals

**Goals:**

- Add a "Delete account" section to the settings page UI
- Allow user to request deletion after confirming with their current password
- Clean up or reassign all related records before deletion
- Invalidate session and redirect to login after deletion
- Log the deletion to audit log
- Rate-limit deletion attempts to prevent abuse

**Non-Goals:**

- Admin-initiated deletion (already exists in admin panel)
- Soft-delete or account recovery (hard delete only)
- Email confirmation flow (current password confirmation is sufficient)
- GDPR data export (separate concern)

## Decisions

- **Reuse existing form route**: The `/settings` POST handler will distinguish between "change password" and "delete account" via a hidden form field (`_action=delete-account`). This avoids adding new routes.
- **Password confirmation for deletion**: Require current password to prevent CSRF-based account deletion and ensure intentionality.
- **Transaction-based cleanup**: Use a database transaction to delete related records first, then the user. This avoids partial deletion states.
- **Messages cleanup strategy**: Reassign messages from deleting user to a "deleted user" placeholder (set `sender_id` to NULL or a system user) rather than deleting conversation history.
- **Workflow runs cleanup**: Reassign `created_by` to NULL or delete orphaned runs depending on business value. Given low likelihood, set to NULL.
- **Rate limiting**: Reuse `createRateLimiter` with stricter limits (3 attempts / 60s per user) for the delete action specifically.

## Risks / Trade-offs

- [Message history loss] → Reassign to NULL instead of deleting, preserving conversation integrity
- [Accidental deletion] → Two-step confirmation (enter password + click delete) with clear warning text
- [Abuse / brute-force attempts] → Rate limit deletion attempts per user
- [Related data integrity] → Transaction ensures atomicity: all cleanup succeeds or nothing is deleted

## Open Questions

- Should there be a grace period / "undo" window before permanent deletion? Current design: no (hard delete on confirmation).
