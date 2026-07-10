## Context

The app currently has email verification on registration and session-based login. There is no password recovery path — users who forget their password must contact an admin. The codebase already has a working email infrastructure (`nodemailer`, `sendEmail`, `mailer` middleware) and a token-based verification pattern (`generateToken`, `verificationExpires`) that can be reused.

## Goals / Non-Goals

**Goals:**

- Provide a self-service password reset flow: email entry → reset link email → new password form
- Prevent user enumeration (same response whether email exists or not)
- Rate-limit the forgot-password endpoint to prevent abuse
- Tokens expire after 1 hour and are single-use
- Reuse existing patterns: `createController`, `remix/html-template` for email templates, `createRateLimiter`, `hashPassword`, `generateToken`

**Non-Goals:**

- No multi-factor authentication
- No SMS or alternative recovery channels
- No account lockout or security question flows
- No password strength meter (reuse existing 8-character minimum)

## Decisions

### D1: Separate columns from verification tokens

Use `password_reset_token` and `password_reset_expires` columns on the `users` table, not the existing `verification_token`/`verification_expires` columns.

**Rationale**: The two flows are independent — a user could reset their password while also having a pending email verification. Reusing columns would create coupling and edge cases (e.g., a reset clearing a verification token).

### D2: No user enumeration

Always show the same success message regardless of whether the email exists: "If an account with that email exists, we've sent a password reset link."

**Rationale**: Standard security practice. Don't reveal which emails are registered. Implement by looking up the user but returning the same response in all cases.

### D3: Two-part route structure

```
auth.forgotten       → GET /auth/forgotten       (show email form)
auth.forgotten       → POST /auth/forgotten      (submit email, send reset email)
auth.forgottenReset  → GET /auth/forgotten/:token (show new password form)
auth.forgottenReset  → POST /auth/forgotten/:token (submit new password)
```

**Rationale**: Matches the existing `auth.login` form route pattern (GET shows form, POST handles submission). The token-in-URL pattern mirrors `auth.verify/:token`. Two separate routes avoid mixing concerns — the token-based reset page has different validation than the email-entry page.

### D4: Token expiry of 1 hour

Password reset tokens expire after 1 hour (verification tokens use 24 hours). A new `resetExpires()` utility function will return `Date.now() + 60 * 60 * 1000`.

**Rationale**: Password reset links are more sensitive than email verification. Shorter window reduces risk if a link leaks.

### D5: Rate limit by IP, not email

Rate-limit the forgot-password POST endpoint by IP address (not by email, since that would leak existence). Use `createRateLimiter` with `perKey: false` (global-based) or a key derived from the request IP.

**Rationale**: If we rate-limited by email, an attacker could determine whether an account exists by observing which emails get rate-limited vs. not. IP-based limiting is coarser but avoids this leak.

### D6: Clear token after successful reset

After a successful password reset, set `password_reset_token` to NULL and `password_reset_expires` to NULL.

**Rationale**: Prevents token reuse. If someone intercepts a reset link after it's been used, it should not work.

## Risks / Trade-offs

- **[Token in URL]** → Reset tokens appear in browser history and server logs. Mitigation: 1-hour expiry, single-use, and clearing after use.
- **[No email enumeration] → Users who typo their email won't know it.** This is the standard UX trade-off for this security pattern.
- **[IP-based rate limiting] → Shared networks (office, university) may hit the limit faster.** Acceptable; users can wait or contact support.
