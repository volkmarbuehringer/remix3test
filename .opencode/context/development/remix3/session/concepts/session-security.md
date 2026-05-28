<!-- Context: development/remix3/session/concepts/session-security | Priority: medium | Version: 1.0 -->

# Concept: Session Security

**Core**: Prevent session fixation by regenerating IDs after privilege changes, destroy sessions on logout, and use signed cookies to prevent tampering.

## Core Concept

Session fixation attacks are prevented by `regenerateId()` which issues a new session ID while preserving data. Calling `regenerateId(true)` marks the old session for deletion on next save. `destroy()` blocks all further mutations and clears the cookie on next save.

## Key Points

- Always call `regenerateId()` after login/privilege escalation to prevent fixation
- `regenerateId(true)` queues old session deletion — passes `deleteId` to storage backends
- Cookie storage cannot delete old sessions and logs a warning for `regenerateId(true)`
- `destroy()` marks session as destroyed; all mutations throw after destruction
- Destroyed sessions return `''` from `save()`, clearing the client cookie

## Quick Example

```typescript
// Login — prevent fixation
session.regenerateId(true)   // new ID, delete old session on save
session.set('userId', user.id)

// Logout — clear everything
session.destroy()            // save() returns '' → clears cookie
```

## Reference

- **Source**: `packages/session/src/lib/session.ts` — `regenerateId()` and `destroy()` methods

## Related

- `session-core.md` — Session lifecycle and state tracking
- `../../core/standards/concepts/security-patterns.md` — General security patterns
- `../../auth/guides/session-middleware.md` — Middleware-level session handling
