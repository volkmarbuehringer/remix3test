## 1. Add frame-request skip to `loadAssetEntry`

- [x] 1.1 In `app/middleware/asset-entry.ts`, wrap asset resolution in a conditional: if `context.request.headers.get('X-Remix-Frame')` is truthy, skip `getHref`/`getPreloads` and proceed directly to `next()`
- [x] 1.2 The context value for `assetsEntryKey` is left unset for frame requests — `getAssetEntry()` returns `undefined`, triggering the existing fallback in `document.tsx`

## 2. Verification

- [x] 2.1 Run `npx tsc --noEmit` — 0 errors
- [x] 2.2 Run `npm test` — all 733 tests pass
- [x] 2.3 Run `npx remix doctor` — 0 warnings
- [x] 2.4 Smoke test: tests cover full page rendering and frame navigation
