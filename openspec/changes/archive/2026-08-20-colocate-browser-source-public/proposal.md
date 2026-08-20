## Why

Browser source code is currently selected by a `.browser.*` filename suffix and scattered across `app/ui/` and `app/actions/`, disconnected from the route that owns it. The upstream Remix demos standardized on colocating browser source in a `public/` subdirectory next to the owning route (see `~/remix/demos`, commit `5ec6f308b`), which makes ownership visible on disk and collapses the asset allow-list to a location glob. This change adopts that convention while preserving a `ui/` tier for genuinely shared browser components.

## What Changes

- Introduce a `<route>/public/` subdirectory convention under `app/actions/<group>/public/` for **route-owned** browser source, matching the upstream demo convention.
- Move route-owned browser files out of `app/ui/` and `app/actions/<group>/*.browser.*` into their owning route's `public/` directory, dropping the `.browser.` suffix in the process (the directory becomes the selector).
- Keep **shared and global** browser components in `app/ui/*.browser.tsx` (e.g. `confirm-delete`, `connection-indicator`, `theme-toggle`, `nav-toggle`, password helpers, `agent-prefill-store`).
- Group agent stream components under `app/assets/streams/public/` (Option A) rather than scattering them across per-agent route dirs.
- Keep entry / frame plumbing (`entry.tsx`, `frame-response`, `error-card`) in `app/assets/` as explicit allow-list entries.
- Rewrite `allowFiles` in `app/assets.ts` from the `.browser.*`-centric glob to: `app/**/public/**` + `app/ui/**/*.browser.*` + explicit `assets/` entries.
- All moves use `git mv` to preserve history.

## Capabilities

### New Capabilities

- `browser-source-colocation`: The structural convention for where browser (client) source lives — route-owned code in `<route>/public/`, shared code in `ui/`, entry plumbing in `assets/` — and the corresponding `assetServer.allowFiles` contract that selects each tier.

### Modified Capabilities

- `controller-feature-colocation`: Extends the existing `app/actions/<group>/` colocation convention to add a `public/` subdirectory for that group's browser source, alongside the existing `controller.tsx`, `pages.tsx`, and test files.

## Impact

- **Code moved (via `git mv`)**: ~16 browser files from `app/ui/` into their owning `app/actions/<group>/public/`; 5 already-in-`actions/lists` files into `app/actions/lists/public/`; 6 stream files into `app/assets/streams/public/`.
- **Imports updated**: server modules (controllers, page components) that reference moved browser files have their import paths rewritten from `../../ui/<name>.browser.tsx` to `./public/<name>.tsx` (route-owned) or `../../ui/<name>.browser.tsx` (shared, unchanged).
- **`app/assets.ts`**: `allowFiles` block rewritten; `fileMap`, `allowPackages`, `denyFiles`, and other options unchanged.
- **No runtime behavior change**: the set of served browser assets and their URLs are preserved; this is a structural refactor.
- **Tests**: `app/assets/*.test.browser.ts` and any asset-served assertions updated to reference the new paths.
