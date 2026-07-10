# SuperHeaders Migration

Replace raw `headers.set('Header-Name', value)` patterns with Remix 3's `SuperHeaders` typed accessors in 4 files, improving type safety and eliminating brittle string manipulation.

## Files to Change

| File                                               | Headers                         | Current Pattern                                    | SuperHeaders API                                           |
| -------------------------------------------------- | ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `app/lib/sse.ts`                                   | `Content-Type`, `Cache-Control` | `headers.set('Content-Type', 'text/event-stream')` | `headers.contentType = { mediaType: 'text/event-stream' }` |
| `app/middleware/render.tsx` (resolveFrame)         | `Accept`, `Accept-Encoding`     | `headers.set('Accept', 'text/html')`               | `headers.accept = new Accept('text/html')`                 |
| `app/middleware/render.tsx` (fragmentResponseInit) | `Cache-Control`                 | `headers.set('Cache-Control', 'no-store')`         | `headers.cacheControl = { noStore: true }`                 |
| `app/test-utils.ts` (extractCookie)                | `Set-Cookie`                    | `setCookie.split(';')[0]` (manual parsing)         | `SetCookie.from(...)` typed parser                         |

## Imports to Add

- `app/lib/sse.ts` — no new imports needed (SuperHeaders via `new Headers()` + property accessors)
- `app/middleware/render.tsx` — `import { Accept, AcceptEncoding } from 'remix/headers'`
- `app/test-utils.ts` — `import { SetCookie } from 'remix/headers'`

## What Stays the Same

- Headers without SuperHeaders helpers (`Connection`, `X-Accel-Buffering`, `X-Remix-Frame`, `X-Remix-Target`) remain as `headers.set(...)` calls
- Response objects wrapping headers remain unchanged
- No behavioral changes — serialized output is identical

## Verification

- All existing tests pass (they assert exact header values)
- `npm run typecheck` passes
