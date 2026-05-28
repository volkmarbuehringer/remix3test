# File Storage

Key/value storage interfaces for server-side `File` objects. One consistent API across local disk and memory backends.

## Key Points

- **Simple API**: `storage.set(key, file)`, `storage.get(key)`, `storage.remove(key)` — like Web Storage for Files
- **Multiple Backends**: Filesystem (`createFsFileStorage`) and memory backends built in; S3 via separate package
- **Metadata Preservation**: Preserves `file.name`, `file.type`, and `file.lastModified`
- **Streaming**: Files stream to/from storage without buffering

## Quick Example

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./user/files')

let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
await storage.set('hello-key', file)

// Later — metadata intact
let fromStorage = await storage.get('hello-key')
fromStorage.name // 'hello.txt'
fromStorage.type // 'text/plain'

// Remove
await storage.remove('hello-key')
```

## Reference

- Full docs: `~/remix/packages/file-storage/README.md`
- Imports: `remix/file-storage/fs`, `remix/file-storage/memory`

## Related

- [form-data-parser](./form-data-parser.md) — Pairs with file-storage for uploaded files
- [lazy-file](../../concepts/lazy-file.md) — Streaming File implementation used internally
- [file-storage-s3](https://github.com/remix-run/remix/tree/main/packages/file-storage-s3) — S3 backend
