<!-- Context: development/remix3/packages/concepts | Priority: low | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Tar Parser

**Purpose**: Streaming tar archive parsing for JavaScript. Handles POSIX/GNU/PAX archives incrementally without buffering full payload.

**Key Points**:
- Universal runtime (works anywhere JavaScript runs)
- Built on web Streams API (composable with fetch streams)
- Supports POSIX, GNU, and PAX tar formats
- Memory efficient - no buffering in normal usage
- Zero dependencies
- Performance on par with node-tar

**Minimal Example**:
```ts
import { parseTar } from 'remix/tar-parser'

let response = await fetch('https://github.com/remix-run/remix/archive/refs/heads/main.tar.gz')

await parseTar(response.body.pipeThrough(new DecompressionStream('gzip')), (entry) => {
  console.log(entry.name, entry.size)
})

// With filename encoding
await parseTar(response.body, { filenameEncoding: 'latin1' }, handler)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/tar-parser