<!-- Context: development/remix3/packages/data | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# file-storage

Key/value storage for server-side File objects with filesystem and memory backends.

## Core Idea

Simple API (set/get/remove) for storing File objects. Preserves metadata (name, type, lastModified). Supports streaming.

## Key Points

- **Backends**: Filesystem (`createFsFileStorage`) and memory
- **Metadata**: Preserves `file.name`, `file.type`, `file.lastModified`
- **Streaming**: Stream content to and from storage
- **S3 Option**: `remix/file-storage-s3` for S3 backend

## Quick Example

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./user/files')

// Store
let file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
await storage.set('hello-key', file)

// Retrieve
let storedFile = await storage.get('hello-key')
storedFile.name  // 'hello.txt'
storedFile.type  // 'text/plain'

// Remove
await storage.remove('hello-key')
```

## Reference

`/home/lucky/remix/packages/file-storage/README.md`