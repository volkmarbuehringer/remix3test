## Context

Current `app/middleware/mailer.ts` creates a nodemailer transport with `secure: false, ignoreTLS: true` and no auth. This works for local SMTP servers (Mailpit, MailHog) but cannot connect to production services requiring authentication.

## Goals / Non-Goals

**Goals:**
- Support SMTP_USER / SMTP_PASSWORD from `.env` for authenticated transport
- Empty credentials = no auth (backward compatible)
- Set `secure: true` when port is 465 and auth is provided

**Non-Goals:**
- OAuth2 or XOAUTH2 support
- Multiple transport selection logic
- Email sending logic changes

## Decisions

- **nodemailer auth block**: Conditionally include `auth` property when both env vars are non-empty; omit entirely when empty (nodemailer checks `auth.user` presence internally)
- **secure / ignoreTLS**: Use `secure: true` for port 465, `secure: false` with `ignoreTLS: true` otherwise. No dependency on auth presence — SMTP port convention drives this
- **Minimal change**: Only touch `app/middleware/mailer.ts` — no changes to `send-email.ts`, middleware stack, or route handlers

## Risks / Trade-offs

- Hardcoded `ignoreTLS: true` may be insecure if someone sets credentials without enabling TLS. Mitigation: port 465 forces `secure: true`; other ports keep `ignoreTLS: true` as before.
- No STARTTLS support on port 587. Mitigation: acceptable for now since Mailgun/SendGrid recommend port 465 with `secure: true`.
