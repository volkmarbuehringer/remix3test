## Why

New users currently register with zero identity verification — anyone can create an account with any email address and immediately log in. This allows fake accounts, blocks legitimate users from reclaiming their own email, and prevents any email-based communication with users. Adding email verification ensures users control the email they register with and opens the door to future email-based features (password reset, notifications).

## What Changes

- **BREAKING**: Registration no longer auto-logs-in the user. After submitting the form, the user sees a "check your email" page instead.
- New `email_verified`, `verification_token`, and `verification_expires` columns on the `users` table.
- A new `GET /auth/verify/:token` route that validates the token, marks the user as verified, and redirects to the login page with a success flash message.
- SMTP email sending via `nodemailer`, configured to send to Mailpit (`localhost:1025`) in development.
- A reusable mailer middleware and `sendEmail` utility for composing and sending transactional emails.
- Preconfigured admin users (seed data) are marked as verified by default — they skip the confirmation flow entirely.
- Login gating: the `loadAuth` middleware's session verification rejects unverified users.

## Capabilities

### New Capabilities

- `email-verification`: Email confirmation at registration — token generation, email delivery, verification endpoint, and login gating for unverified accounts.
- `transactional-email`: Reusable email infrastructure — SMTP transport via nodemailer, mailer middleware, and a `sendEmail` helper for composing and sending emails.

### Modified Capabilities

None — this is entirely new functionality; no existing specs change.

## Impact

- **Database**: New columns on `users` table (`email_verified`, `verification_token`, `verification_expires`). Migration required.
- **Routes**: New `auth.verify` route. Existing `auth.register` behavior changes (no auto-login).
- **Middleware**: New `mailer` middleware in the stack. Updated `loadAuth` to gate unverified users.
- **Dependencies**: Adds `nodemailer` and `@types/nodemailer` npm packages.
- **Environment**: New `SMTP_HOST`, `SMTP_PORT` env vars (default to Mailpit in dev).
- **Seed data**: Existing admin seed users updated to have `email_verified = true`.
- **Tests**: Existing registration tests will break (redirect now goes to verification page, not home). New tests for verification flow, email sending, and login gating.
