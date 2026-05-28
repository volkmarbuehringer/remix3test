<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: File Storage

**Purpose**: Key/value storage interface for server-side File objects. One consistent API across filesystem and memory backends.

**Key Points**:
- Simple key/value API (Web Storage-like, but for Files)
- Built-in filesystem and memory backends
- Streaming support
- Preserves File metadata (name, type, lastModified)

**Minimal Example**:
```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./user/files')

let file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
await storage.set('hello-key', file)

let fileFromStorage = await storage.get('hello-key')
fileFromStorage.name // 'hello.txt'
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/file-storage