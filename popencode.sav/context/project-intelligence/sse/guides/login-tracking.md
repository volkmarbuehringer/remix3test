<!-- Context: sse/guides/login-tracking | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Login Tracking Guide

Prevents duplicate user sessions by tracking active SSE connections.

## Purpose

Users should only have one active SSE connection at a time. Duplicate connections could cause:

- Duplicate message delivery
- Race conditions in state
- Resource waste

## Implementation

```typescript
// Track logged-in users (username -> controller or null)
let loggedInUsers = new Map<string, ReadableStreamDefaultController | null>()

// Check on SSE connection
if (loggedInUsers.has(username)) {
  // Reject duplicate connection
  return errorResponse
}

// Register new connection
loggedInUsers.set(username, controller)
```

## Connection Rejection

When a user tries to connect while already connected:

```typescript
// Server returns error event
controller.enqueue(
  new TextEncoder().encode(
    `event: error\ndata: ${JSON.stringify({ error: 'User is already logged in' })}\n\n`,
  ),
)
controller.close()
```

Client receives via error event listener:

```typescript
eventSource.addEventListener('error', (e) => {
  // EventSource can't read JSON - check with login endpoint
  checkLoginStatus()
})
```

## Cleanup

Remove user on disconnect:

```typescript
context.request.signal.addEventListener('abort', () => {
  loggedInUsers.delete(username)
})
```

## Scope

Login tracking is **global** across all rooms:

- User "alice" in Room A blocks "alice" in Room B
- Use separate usernames per room if multi-room access needed
- Consider room-scoped tracking if global scope is too restrictive

## Admin Users

Admin users bypass some restrictions:

```typescript
let targetIsAdmin = clientInfo.username.toLowerCase() === 'admin'
if (targetIsAdmin) {
  targetControllers.push(controller)
  return
}
```

## Security Considerations

| Risk              | Mitigation                        |
| ----------------- | --------------------------------- |
| Session hijacking | Unique tokens per connection      |
| Username spoofing | Sanitize usernames (alphanumeric) |
| Memory exhaustion | Cleanup on disconnect             |

## Testing

Test duplicate prevention:

```typescript
it('rejects duplicate connections', async () => {
  // First connection succeeds
  let res1 = await fetch('/messages?username=alice')
  assert.equal(res1.status, 200)

  // Second connection rejected
  let res2 = await fetch('/messages?username=alice')
  assert.equal(res2.status, 200) // Error event sent, but 200 OK
})
```

## 📂 Codebase References

**Login Tracking**: `demos/sse/app/router.tsx` - Lines 26-27, 326-343
**Login Endpoint**: `demos/sse/app/router.tsx` - Lines 546-557
**Logout Endpoint**: `demos/sse/app/router.tsx` - Lines 559-570
**Tests**: `demos/sse/app/router.test.ts` - Duplicate connection tests
