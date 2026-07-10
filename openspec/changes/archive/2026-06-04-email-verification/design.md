## Context

The app currently has a simple registration flow: user submits form → account created → auto-logged-in → redirect to home. There is no email infrastructure at all. Mailpit is available at `localhost:1025` for local email testing. This design adds email verification and the foundational email infrastructure to support it and future email features.

## Goals / Non-Goals

**Goals:**

- Send a verification email with a unique token link after registration
- Gate login to require verified email (except for preconfigured admin users)
- Provide reusable email infrastructure (transport, helper) for future emails
- Work with Mailpit in local dev and any SMTP server in production
- Existing admin seed users bypass verification

**Non-Goals:**

- Password reset flow (separate change)
- Resend verification email (can be added later)
- Bulk email / newsletter sending
- Email open tracking or analytics
- Multi-tenancy or per-tenant SMTP configs

## Decisions

### 1. Token: Random bytes, DB-backed

**Chosen:** Crypto-random token (32 bytes, base64url-encoded), stored in `users` table with expiry.

**Alternatives considered:**

- JWT/HMAC signed token: Stateless but can't revoke individually, adds crypto complexity for no real benefit here.
- Separate `email_verifications` table: Cleaner separation but overkill for a single verification flow. If we add password reset tokens later, we can extract a table then.

**Rationale:** Simple, invalidation by clearing the column, expiry by timestamp comparison. One DB write on verification.

### 2. Email library: nodemailer

**Chosen:** `nodemailer` (industry standard for Node.js SMTP).

**Alternatives considered:**

- Raw `node:net` SMTP: Too low-level, no MIME handling, no HTML email support.
- Service-specific SDK (Resend, SendGrid): Ties us to a vendor.

**Rationale:** Works with any SMTP server including Mailpit. Well-tested, handles MIME, HTML, attachments. The app can swap backends by changing `SMTP_HOST`/`SMTP_PORT` env vars.

### 3. Architecture: Middleware + utility pattern

**Chosen:** A `mailer()` middleware creates the nodemailer transport and exposes a `sendEmail` function on the context, used by a utility module that composes email content.

```
app/middleware/mailer.ts      ← creates transport, context.mailer.sendEmail()
app/utils/send-email.ts       ← composeAndSendVerificationEmail(user, token)
app/utils/verification-token.ts ← generateToken(), TOKEN_BYTES constant
```

**Rationale:** Follows the existing pattern (`loadDatabase` → `context.db`, `loadAuth` → `context.get(Auth)`). The middleware owns transport lifecycle; utilities own content composition. Keep email templates/HTML in `app/utils/` alongside the send helper since they're specific to transactional emails, not general UI.

### 4. Verification token link: absolute URL using request origin

**Chosen:** Construct the verification URL from the incoming request's origin (`context.url.origin`) plus `routes.auth.verify.href({ token })`.

**Rationale:** Works in any environment (local dev, staging, production) without a `BASE_URL` env var. The route contract in `routes.ts` is the single source of truth for URL structure.

### 5. Login gate: Session auth scheme verifier

**Chosen:** Add an `email_verified` check in the existing `verify` function inside `loadAuth()`'s session auth scheme. Admin users (role = 'admin') skip the check.

**Rationale:** Zero new middleware. The gate applies consistently to all session-authenticated routes. For user enumeration protection, the credentials auth provider still returns a misleading "Invalid email or password" message (unchanged behavior).

### 6. Registration flow change: redirect to verification page

**Chosen:** After creating the user, redirect to a new page at `routes.auth.register.verifySent.href()` that shows "Check your email." No session is set.

**Alternative considered:** Render the page inline without redirect (POST → 200 HTML). **Rejected** because the POST-then-redirect pattern prevents form resubmission on refresh.

### 7. Schema changes: columns on users table

Three new columns on the `users` table:

| Column                 | Type               | Purpose                        |
| ---------------------- | ------------------ | ------------------------------ |
| `email_verified`       | integer (0/1)      | Whether the email is confirmed |
| `verification_token`   | text (nullable)    | One-time verification token    |
| `verification_expires` | integer (epoch ms) | Token expiry timestamp         |

The `Schema` module already uses `beforeWrite`/`afterRead` hooks. New columns get defaults in `beforeWrite` (0 for email_verified on create, null for token/expiry on create) and `parseIntFields` in `afterRead`.

## Risks / Trade-offs

- **Risk:** Verification token could be brute-forced (32 bytes = 256 bits, effectively impossible with random generation). → **Mitigation:** Use `crypto.getRandomValues` (CSPRNG). Add rate limiting on the verify endpoint as a follow-up.
- **Risk:** Expired tokens accumulate as unverified users pile up. → **Mitigation:** Acceptable for now. A cleanup task can be added later (e.g., cron to delete unverified users older than 7 days).
- **Risk:** Registration tests break because the success path changes (redirect target, no auto-login). → **Mitigation:** Update tests as part of the implementation. This is expected.
- **Trade-off:** Adding `nodemailer` as a dependency adds ~500KB to node_modules. → **Acceptable:** It's the standard library and we'd need it eventually for any email feature.

## Open Questions

- Should we add a rate limit on the verify endpoint to prevent token guessing? (Recommended as a follow-up if needed.)
- Should unverified accounts be automatically deleted after N days? (Can be a separate cleanup task.)
