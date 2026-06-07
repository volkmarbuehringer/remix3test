## 1. Update env config

- [x] 1.1 Add `SMTP_USER` and `SMTP_PASSWORD` to `.env.example` with empty defaults

## 2. Modify mailer middleware

- [x] 2.1 Read `SMTP_USER` and `SMTP_PASSWORD` from env in `app/middleware/mailer.ts`
- [x] 2.2 Conditionally set nodemailer `auth` when both credentials are non-empty
- [x] 2.3 Set `secure: true` when port is 465, `false` otherwise
- [x] 2.4 Keep `ignoreTLS: true` for non-465 ports (backward compat)

## 3. Verify

- [x] 3.1 Run existing tests to confirm backward compatibility
- [x] 3.2 Run `npm run typecheck`