<!-- Context: development/remix3/session/guides/standard-pattern | Priority: medium | Version: 1.0 -->

# Guide: Standard Session Pattern

**Core**: The universal session lifecycle is read → modify → save. `read(cookie)` hydrates the session, you call get/set/flash/destroy, then `save(session)` persists and returns the new cookie value.

## Core Concept

This pattern is used by all storage backends. `read()` either finds existing data or creates a fresh session. After modification, `save()` checks `dirty` — if clean, it returns `null` (no cookie to set). If dirty or destroyed, it serializes and returns the new cookie value (or `''` for destroyed).

## Key Points

- Always pair `read()` and `save()` — one without the other leaks state
- `save()` returns `null` if session is unchanged — skip `Set-Cookie` header
- `save()` returns `''` if session is destroyed — clears the client cookie
- Destroyed sessions: `session.destroy()` blocks further mutations, `save()` returns `''`
- Flash messages make session dirty automatically — ensures they are serialized and cleared

## Quick Example

```typescript
async function handleRequest(cookie: string | null) {
  let session = await storage.read(cookie)
  session.set('count', (session.get('count') ?? 0) + 1)

  return {
    session,
    cookie: await storage.save(session), // null if unchanged
  }
}

// Apply cookie to response
new Response(body, {
  headers: cookie ? { 'Set-Cookie': cookie } : undefined,
})
```

## Reference

- **Source**: `packages/session/src/lib/session-storage.ts` — SessionStorage read/save contract

## Related

- `session-core.md` — Dirty tracking and session state
- `session-storage-interface.md` — read/save contract
- `flash-messages.md` — How flash makes session dirty
- `../../auth/guides/session-middleware.md` — Automatic read/save via middleware
