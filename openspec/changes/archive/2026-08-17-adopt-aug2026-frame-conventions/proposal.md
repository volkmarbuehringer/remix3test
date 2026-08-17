## Why

The `remix` preview (`preview/main`) shipped several frame-navigation and asset-pipeline fixes between Aug 10–15, 2026 that the demos now follow but this app has not adopted. Two of them are correctness bugs in this app's frame architecture (client-entry preloads missing, redirect-during-frame-reload injecting document UI into a subframe), one is a stale auth decision (frame check ignores `X-Remix-Target`), and one is a navigation-quality improvement (`rmx-history` for GET filter forms).

## What Changes

- **Client-entry preloads**: `app/middleware/render.tsx` `resolveClientEntry()` SHALL return `preloads` from `assetServer.getPreloads(entryId)` (mirrors `#11681`), so client entries preload their browser module graphs.
- **Redirect handling on frame reload**: `app/assets/entry.tsx` `resolveFrameResponse()` SHALL detect `response.redirected` with a frame target and navigate the top frame via `window.location.assign(response.url)` instead of injecting document UI into the subframe (mirrors `#11667`).
- **Subframe auth check**: `app/middleware/auth.ts` `requireAuth` SHALL treat a request as a subframe request only when both `X-Remix-Frame: true` AND `X-Remix-Target` are present; a top-frame reload of a frame-destined URL SHALL redirect to login instead of returning the 401 fragment (mirrors `#11667`).
- **GET filter history**: GET filter forms on admin grids SHALL use `rmx-history="replace"` so each filter change replaces rather than pushes history entries (mirrors `#11670`).

## Capabilities

### New Capabilities

- `frame-navigation-conventions`: behavior contract for frame client-entry preloads, redirect handling during frame reloads, subframe-vs-topframe auth distinction, and history semantics for GET frame navigation.

### Modified Capabilities

- `programmatic-frame-reload`: frame reload behavior gains redirect handling — a frame reload whose server response redirects SHALL navigate the top frame rather than render document UI inside the subframe.

## Impact

- `app/middleware/render.tsx` — `resolveClientEntry` return shape (adds `preloads`).
- `app/assets/entry.tsx` — `resolveFrameResponse` redirect branch.
- `app/middleware/auth.ts` — subframe detection in `requireAuth`.
- `app/actions/client/grid-page.tsx`, `app/ui/admin-lists-page.tsx` — `rmx-history="replace"` on GET filter forms.
- Tests: `app/middleware/auth.test.ts`, controller tests asserting 401-vs-redirect behavior, and any `resolveClientEntry`/preload assertions.