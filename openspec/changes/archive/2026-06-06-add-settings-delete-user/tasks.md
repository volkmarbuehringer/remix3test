## 1. Controller: Add delete account handler

- [x] 1.1 Add deleteAccount rate limiter (3 attempts/60s per user) to settings controller
- [x] 1.2 Import `pool` from `app/data/connection.ts` and `logAdminAction` from `app/data/audit-log.ts`
- [x] 1.3 Add `_action` form field routing to distinguish "delete-account" from "change-password" in the POST handler
- [x] 1.4 Implement delete-account handler: validate current password, clean up related records in a transaction, delete user, log audit entry
- [x] 1.5 Handle foreign key cleanup: SET NULL on `messages.sender_id` and `workflow_runs.created_by` before user deletion
- [x] 1.6 Invalidate session and redirect to login after successful deletion
- [x] 1.7 Return error messages for incorrect password, rate limit exceeded

## 2. UI: Add delete account section to settings page

- [x] 2.1 Add "Delete account" section below the password change form in `SettingsPage` component
- [x] 2.2 Include warning text about permanent data loss, current password input, and "Delete account" submit button
- [x] 2.3 Add CSS for the delete section (danger-themed panel, warning banner, red submit button)
- [x] 2.4 Wire the delete form to the same `routes.settings.action.href()` with `_action=delete-account` hidden field

## 3. Tests

- [x] 3.1 Add test: settings page renders delete account section when authenticated
- [x] 3.2 Add test: successful deletion clears session and redirects to login
- [x] 3.3 Add test: incorrect password shows error
- [x] 3.4 Add test: rate limiting blocks excessive deletion attempts
- [x] 3.5 Add test: related records are cleaned up (messages sender_id set to NULL) [todo]
- [x] 3.6 Verify typecheck and tests pass
