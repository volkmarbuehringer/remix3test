## Why

The current nodemailer transport has no authentication support, making it impossible to use authenticated SMTP services (SendGrid, Mailgun, etc.) in production. SMTP_USER and SMTP_PASSWORD env vars need to be added, with the ability to leave them empty for local dev (Mailpit/MailHog).

## What Changes

- Add `SMTP_USER` and `SMTP_PASSWORD` env vars to `.env.example`
- Conditionally configure nodemailer `auth` when credentials are present
- Adjust `secure`/`ignoreTLS` behavior based on auth presence (use `secure: true` for port 465, else `false`)
- Keep backward compatibility: empty credentials = current no-auth behavior

## Capabilities

### New Capabilities

- `mail-transport-auth`: Authenticated SMTP transport via env vars

### Modified Capabilities

_(none — purely an implementation/infrastructure change)_

## Impact

- `app/middleware/mailer.ts` — transport creation logic
- `.env.example` — new SMTP_USER / SMTP_PASSWORD entries
