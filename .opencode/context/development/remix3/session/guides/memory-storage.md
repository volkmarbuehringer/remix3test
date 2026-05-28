<!-- Context: development/remix3/session/guides/memory-storage | Priority: medium | Version: 1.0 -->

# Guide: Memory Session Storage

**Core**: `createMemorySessionStorage` stores sessions in a `Map<string, SessionData>` in process memory. Data is lost on server restart — ideal for testing, development, and single-process deployments.

## Core Concept

All session data lives in an in-memory `Map` keyed by session ID. No serialization, no I/O overhead, but no persistence across restarts. Supports the same `useUnknownIds` option as filesystem storage for accepting unknown client IDs.

## Key Points

- **Imports from**: `remix/session/memory-storage`
- **Data lost on restart**: Not for production deployments requiring persistence
- **`useUnknownIds`**: Accept client-provided IDs even if not in the map — returns new session
- **No I/O overhead**: Fastest backend, ideal for tests
- **On save**: Deletes old entry if `deleteId` set; deletes entry if destroyed

## Quick Example

```typescript
import { createMemorySessionStorage } from 'remix/session/memory-storage'

let storage = createMemorySessionStorage()
let session = await storage.read(null) // creates new session
session.set('count', 1)
await storage.save(session)
```

## Reference

- **Source**: `packages/session/src/lib/session-storage/memory.ts` — `createMemorySessionStorage`

## Related

- `session-storage-interface.md` — Interface contract
- `filesystem-storage.md` — Persistent alternative with same options
- `cookie-storage.md` — Stateless alternative
