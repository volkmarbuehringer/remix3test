## Why

Users need the ability to permanently delete their own account from the settings page. Currently only admins can delete users via the admin panel. Self-service account deletion improves user autonomy and aligns with data privacy expectations (GDPR right to deletion).

## What Changes

- Add a "Delete account" section to the settings page (`/settings`) with a confirmation flow
- POST handler in the settings controller to delete the current user and their associated data, then log out
- Handle foreign key constraints: delete/reassign messages and workflow runs before user deletion
- Log the deletion to audit log (as a self-service action)
- Add rate limiting to prevent abuse

## Capabilities

### New Capabilities
- `settings-self-deletion`: Self-service account deletion from the settings page with confirmation and cascading cleanup of related records

### Modified Capabilities

- `password-confirmation-visibility`: Settings page will include a new "Delete account" section alongside the existing password change form

## Impact

- `app/actions/settings/controller.tsx` — Add delete handler and UI section
- `app/data/migrate.ts` — May need migration to handle `messages.sender_id` and `workflow_runs.created_by` constraints (change RESTRICT to SET NULL or add cleanup logic)
- No route changes needed — reuses existing `form('settings')` route
