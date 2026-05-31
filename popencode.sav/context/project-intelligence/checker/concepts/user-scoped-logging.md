<!-- Context: project-intelligence/checker/concepts/user-scoped-logging | Priority: high | Version: 1.0 | Updated: 2026-04-19 -->

# User-Scoped Logging

**Purpose**: Enable tracing of logs to individual users for debugging and audit in multi-user environments.

---

## Problem

In multi-user applications, standard console logs don't identify which user made a request, making it difficult to:
- Debug issues specific to one user
- Trace requests through complex flows
- Audit user actions for security

## Solution

The user-scoped logging pattern adds user context to every log message via prefix.

### Core Functions

**`getUserLogId()`** — Returns user identifier:
- `user:{id}` — If authenticated
- `guest` — If not authenticated

**`userLogger(prefix)`** — Creates logger with user context:
```typescript
import { userLogger } from '../../utils/logger.ts'

let logger = userLogger('Agent')
logger.log('GET index - SSR with conversation history')
```

### Log Output Format

```
[{Prefix}] [{UserId}] {Message}
```

**Examples:**
- `[Agent] [user:1] GET index - SSR with conversation history`
- `[Agent] [user:2] POST action - processing message`
- `[Chat] [user:1] message parsed: Hello`
- `[Chat] [guest] GET index - SSR with conversation history`

---

## Implementation

### File: `checker/app/utils/logger.ts`

```typescript
import { getCurrentUserSafely } from './context.ts'

export function getUserLogId(): string {
  let user = getCurrentUserSafely()
  if (user) {
    return `user:${user.id}`
  }
  return 'guest'
}

export function userLogger(prefix: string) {
  let userId = getUserLogId()

  function log(...args: unknown[]) {
    console.log(`[${prefix}] [${userId}]`, ...args)
  }

  function warn(...args: unknown[]) {
    console.warn(`[${prefix}] [${userId}]`, ...args)
  }

  function error(...args: unknown[]) {
    console.error(`[${prefix}] [${userId}]`, ...args)
  }

  return { log, warn, error }
}
```

### User Dependency

Uses `getCurrentUserSafely()` from `context.ts` to access authenticated user from request context:
- Uses async context middleware (`remix/async-context-middleware`)
- Returns `User` object with `id` property
- Gracefully handles unauthenticated requests

---

## Usage

### Before (No User Context)
```typescript
console.log('GET index - SSR with conversation history')
// Output: GET index - SSR with conversation history
```

### After (With User Context)
```typescript
import { userLogger } from '../../utils/logger.ts'

let logger = userLogger('Agent')
logger.log('GET index - SSR with conversation history')
// Output: [Agent] [user:1] GET index - SSR with conversation history
```

### Applied In

| Controller | File |
|------------|------|
| Agent | `checker/app/controllers/agent/controller.tsx` |
| Chat | `checker/app/controllers/chat/controller.tsx` |

---

## Related

- Auth context: `checker/app/utils/context.ts`
- Session middleware: `../../development/remix3/guides/session-middleware.md`
- Auth middleware: `../../development/remix3/guides/auth-middleware.md`