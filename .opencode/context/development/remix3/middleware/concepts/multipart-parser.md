---
title: Multipart Parser
category: concepts
type: context
source: /home/lucky/remix/packages/multipart-parser/src/index.ts
tags: [remix3, concepts, parser, file-upload, multipart]
---

# Multipart Parser

## Core Concept
Streaming multipart/form-data parser for Remix file uploads. Handles large files without buffering entire payloads in memory.

## Key Points
- Supports file and field extraction
- Configurable file size/max parts limits
- Integrates with Remix's form-data middleware
- Provides both streaming and buffered APIs
- Emits progress events for large uploads

## Example
```ts
import { parseMultipart } from 'remix/multipart-parser'

export async function action({ request }: ActionArgs) {
  const parts = await parseMultipart(request, { maxFileSize: 10_000_000 })
  for await (const part of parts) {
    if (part.type === 'file') console.log('File:', part.filename)
  }
}
```

## Reference
- [RFC 7578 Multipart Form Data](https://datatracker.ietf.org/doc/html/rfc7578)
