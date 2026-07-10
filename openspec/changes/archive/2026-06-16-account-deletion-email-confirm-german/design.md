## Context

The app currently sends two types of transactional emails (verification, password reset), both in English. The rest of the app UI is in German. No i18n library or locale system exists — email templates use hardcoded strings via `remix/html-template`. Account deletion (self-service and admin-initiated) sends no email notification.

The existing email infrastructure uses nodemailer via `app/middleware/mailer.ts` with a `context.mailer` middleware. Template helpers live in `app/utils/send-email.ts`.

## Goals / Non-Goals

**Goals:**

- Translate all existing email templates (verification, password reset) to German
- Send a confirmation email when a user deletes their own account
- Send a confirmation email when an admin deletes a user's account
- Keep template content maintainable without introducing a full i18n framework

**Non-Goals:**

- No full i18n / locale framework (avoid scope creep)
- No multi-language support beyond German (not requested)
- No changes to email sending infrastructure (SMTP, middleware)
- No UI changes beyond email content
- No email notification for non-deletion account events

## Decisions

### Decision: Locale strings object pattern instead of i18n library

**Why**: The app has no i18n dependency and needs only German for emails. A simple `locale/de.ts` export file with string constants keeps things readable, testable, and avoids adding a 20kB+ i18n library for one locale.

**Alternatives considered**: `i18next` (overkill), hardcoding inline (current state — works but makes future changes error-prone), `remix/cookie` for locale detection (unnecessary with single locale).

### Decision: Delete confirmation email sent before session destruction

**Why**: For self-deletion, the email must be sent while the user record still exists so we can read their name/email. The email goes out before `session.regenerateId()` and redirect to login. If sending fails, the deletion still proceeds (non-blocking, error logged only).

### Decision: Reuse existing `sendEmail` helper signature

**Why**: The existing `SendEmailFn` type and `createSendEmail` pattern works well. The new `sendAccountDeletionEmail()` follows the same pattern as `sendVerificationEmail()` and `sendPasswordResetEmail()`.

### Decision: Log email send failure instead of blocking the action

**Why**: Email delivery failures should not prevent account deletion. The user initiated a destructive action; blocking it due to a downstream email issue creates a poor experience. Failure is logged to console, same as the existing email sending pattern.

## Risks / Trade-offs

- **Email delivery reliability**: If the SMTP server is down, the user won't get the confirmation but their account will still be deleted. Mitigation: Log errors, monitor SMTP uptime separately.
- **No queuing/retry**: Emails are sent synchronously in the request path. For a low-volume transactional app this is acceptable; if volume grows, a job queue should be added. Mitigation: The `sendEmail` wrapper can be swapped for a queued sender later without changing call sites.
- **Admin deletion may not have user name available**: The admin users controller may only have the user ID at deletion time. Mitigation: Fetch the user's name and email before the delete operation, or fall back to a generic greeting.
