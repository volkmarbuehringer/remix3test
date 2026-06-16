## Why

All transactional emails (verification, password reset) are currently in English, while the rest of the application UI is in German. Additionally, users who delete their accounts receive no confirmation email, leaving them without proof of deletion or a record for support inquiries.

## What Changes

- Translate all existing email templates (verification, password reset) from English to German
- Send a confirmation email to the user when their account is deleted via self-deletion (Settings page)
- Send a confirmation email to the user when an admin deletes their account
- Add a dedicated email template for account deletion confirmation

## Capabilities

### New Capabilities
- `account-deletion-notification`: Email notification sent to users when their account is deleted, including reason/context and support contact info

### Modified Capabilities
- `transactional-email`: All email templates translated to German; new deletion confirmation template added to the send-email utilities

## Impact

- `app/utils/send-email.ts` — translate existing templates, add `sendAccountDeletionEmail()` function
- `app/actions/settings/controller.tsx` — send deletion confirmation email before clearing session
- `app/actions/admin/users/controller.tsx` — send deletion confirmation email on admin-initiated deletion
- No new dependencies required
