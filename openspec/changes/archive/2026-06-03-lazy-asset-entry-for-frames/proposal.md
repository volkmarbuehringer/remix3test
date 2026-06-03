## Why

`loadAssetEntry` middleware calls `assetServer.getHref()` + `assetServer.getPreloads()` — potentially expensive file I/O and asset hashing — on every request. But asset entry data is only needed for full-page HTML renders. Frame requests, SSE connections, and API responses never use it.

The consumer (`getAssetEntry()`) already handles `undefined` gracefully with an optional chain + fallback at `app/ui/document.tsx:89`.

## What Changes

- Add a conditional skip in `loadAssetEntry` middleware: when `X-Remix-Frame` header is present, don't resolve assets. The middleware passes through without setting the context value, and the consumer falls back to the default asset path.
- No other files change — the receiver already handles the undefined case.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — no behavioral change to existing capabilities. The fallback path in `document.tsx` was already present.

## Impact

- **Files modified**: `app/middleware/asset-entry.ts` (one conditional)
- **Files affected**: none — behavior is identical for non-frame requests
- **Performance**: saves two `await` I/O calls per frame request and per SSE event
- **Breaking changes**: none
