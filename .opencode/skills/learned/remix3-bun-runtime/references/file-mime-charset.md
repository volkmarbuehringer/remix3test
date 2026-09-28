# Bun's `File` Appends `;charset=utf-8`, Breaking Exact MIME Allowlists

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** Uploads that pass under Node are rejected under Bun with `Dateityp nicht erlaubt.`

## Problem

```js
new File(['x'], 'a.txt', { type: 'text/plain' }).type
// node: "text/plain"    bun: "text/plain;charset=utf-8"
```

An exact-match allowlist (`ALLOWED_MIME_TYPES.has(file.type)`) then rejects valid uploads.

## Solution

Compare the media type only, and store the normalized value:

```ts
import { ContentType } from 'remix/headers/content-type'

export function normalizeMimeType(mime: string): string {
  return ContentType.from(mime).mediaType?.toLowerCase() ?? ''
}
```

Delegate to the vendor parser instead of a hand-rolled `split(';')`: `ContentType.from()` is browser-safe (usable from the clientEntry-shared `app/utils/upload-validation.ts`) and hardened for quoted/parameterized values (#11901). It preserves the media type's case, so lower-case it here. Keep the client-safe validator and the server handler in sync (`app/utils/upload-validation.ts` ↔ `app/middleware/uploads.ts`).
