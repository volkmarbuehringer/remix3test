<!-- Context: project-intelligence/newapp/errors/session-secret-hardcoded | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Error: Hardcoded Session Secret

**Severity**: 🔴 High

**File**: `app/middleware/session.ts` — `secrets: ['s3cr3t-k3y-f0r-n3wapp']`

The session cookie secret is hardcoded. Session cookies signed with a well-known key could be forged or tampered with.

**Fix**: Use `process.env.SESSION_SECRET` with a fallback:

```tsx
secrets: [process.env.SESSION_SECRET ?? 'dev-secret']
```

Add `SESSION_SECRET` env var check in `server.ts` or a config module.
