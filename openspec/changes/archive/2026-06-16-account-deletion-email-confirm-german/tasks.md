## 1. Translation Support

- [x] 1.1 Create `app/locale/de.ts` with German email subject and body string constants
- [x] 1.2 Export typed locale object for consumption by email templates

## 2. Translate Existing Email Templates

- [x] 2.1 Update `sendVerificationEmail()` to use German locale strings (subject, HTML body, text body)
- [x] 2.2 Update `sendPasswordResetEmail()` to use German locale strings (subject, HTML body, text body)

## 3. Account Deletion Email Template

- [x] 3.1 Add `sendAccountDeletionEmail()` to `app/utils/send-email.ts` with German subject and body
- [x] 3.2 Support distinct body text for self-deletion vs. admin-initiated deletion

## 4. Wire Deletion Email into Self-Deletion Flow

- [x] 4.1 In `app/actions/settings/controller.tsx`, call `sendAccountDeletionEmail()` before session cleanup and redirect
- [x] 4.2 Handle email send failure gracefully (log error, do not block deletion)

## 5. Wire Deletion Email into Admin Deletion Flow

- [x] 5.1 In `app/actions/admin/users/controller.tsx`, fetch user email before deletion
- [x] 5.2 Call `sendAccountDeletionEmail()` after successful deletion
- [x] 5.3 Handle email send failure gracefully (log error, do not block deletion)

## 6. Tests

- [x] 6.1 Update existing `send-email.test.ts` to verify German content
- [x] 6.2 Add test for `sendAccountDeletionEmail()` template
- [x] 6.3 Update settings controller test to verify email is sent on self-deletion
- [x] 6.4 Update admin users controller test to verify email is sent on admin deletion
