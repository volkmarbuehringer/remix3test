<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: FS

**Purpose**: Lazy, streaming filesystem utilities using LazyFile/native File API. Works seamlessly with Node.js file handles.

**Key Points**:
- Uses LazyFile which matches native File API
- Provides `.stream()`, `.toFile()`, `.toBlob()` for conversions
- Seamless Node.js compatibility
- Lazy loading - no data read until called

**Minimal Example**:
```ts
import { openLazyFile } from 'remix/fs'

let lazyFile = openLazyFile('./path/to/file.json')
let json = JSON.parse(await lazyFile.text()) // Lazy - not read until called

let customFile = openLazyFile('./image.jpg', {
  name: 'custom-name.jpg',
  type: 'image/jpeg',
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/fs