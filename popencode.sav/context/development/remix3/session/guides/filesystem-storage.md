<!-- Context: development/remix3/session/guides/filesystem-storage | Priority: medium | Version: 1.0 -->

# Guide: Filesystem Session Storage

**Core**: `createFsSessionStorage` persists session data to disk using Node.js `fs`, hashing IDs into a 2-char subdirectory structure for filesystem-friendly distribution.

## Core Concept

Sessions are stored as JSON files on disk. The session ID is SHA-256 hashed, with the first 2 characters used as a subdirectory and the remainder as the filename. This prevents too many files in a single directory. The storage directory auto-creates if missing.

## Key Points

- **Imports from**: `remix/session/fs-storage`
- **Path structure**: `dir/{hash[0..2]}/{hash[2..]}.json` — prevents directory sprawl
- **Auto-create**: Directory created recursively if it doesn't exist on first read/save
- **`useUnknownIds: true`**: Accept client-provided IDs even if no matching file — returns new session
- **On save**: Deletes old session file if `deleteId` set; deletes file if destroyed

## Quick Example

```typescript
import { createFsSessionStorage } from 'remix/session/fs-storage'

let storage = createFsSessionStorage('/tmp/sessions', { useUnknownIds: true })
let session = await storage.read(cookieHeader)
session.set('cart', ['item1', 'item2'])
let cookie = await storage.save(session) // persisted to disk
```

## Reference

- **Source**: `packages/session/src/lib/session-storage/fs.ts` — `createFsSessionStorage`, `FsSessionStorageOptions`

## Related

- `session-storage-interface.md` — Interface contract
- `session-security.md` — Old session deletion on regenerateId(true)
- `memory-storage.md` — Alternative in-memory backend
