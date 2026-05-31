<!-- Context: development/remix3/session/concepts/session-core | Priority: medium | Version: 1.0 -->

# Concept: Session Core

**Core**: The `Session` class manages key/value state with built-in flash support, dirty tracking, and destroy protection. It is the central data structure for all session storage backends.

## Core Concept

Session holds two data maps — `valueData` (persistent) and `flashData` (single-round-trip). It tracks whether it has been modified (`dirty`), destroyed, and provides typed access to stored values. The ID can be regenerated for security.

## Key Points

- Session state is split: `valueData` for persistent keys, `flashData` for one-time flash values
- `dirty` flag tracks modifications; `save()` skips persistence if session is clean
- Destroyed sessions block all writes (set, unset, flash, regenerateId) with an error
- Factory `createSession()` generates a UUID v4 via `crypto.randomUUID()` automatically
- `data` getter exposes raw [`valueData`, `flashData`] tuple for storage serialization

## Quick Example

```typescript
import { createSession } from 'remix/session'

let s = createSession('abc123', [{ user: 'alice' }, { message: 'hello' }])
s.get('user')       // 'alice'
s.get('message')    // 'hello' (from flash)
s.dirty             // false if flash was just loaded
s.destroy()
s.set('x', 1)       // throws: Session has been destroyed
```

## Reference

- **Source**: `packages/session/src/lib/session.ts` — Session class + `createSession`/`createSessionId`

## Related

- `session-storage-interface.md` — How storage backends use Session.data
- `session-security.md` — Session fixation prevention
- `flash-messages.md` — Flash message lifecycle
