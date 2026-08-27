---
name: remix3-assets-config-inspection
description: "Make remix.json the single source of truth for the asset server: loadConfig(import.meta.dirname) + spread config.assets, then add runtime-only options in code. Debug with `remix assets` / `remix assets inspect`. Version-pinned gotcha: the assets parser is strict and accepts `mounts` (fileMap removed — the README and parser agree); `mounts` recurses under each root, defaults to `{ app: 'app', npm: 'node_modules' }`, and denyFiles stays scoped to app/** so package-internal test files remain reachable."
user-invocable: false
origin: auto-extracted
---

# Remix 3 Shared Asset Config + Inspector

**Extracted:** 2026-08-27
**Context:** Upstream commit `207dcd2` ("Add shared asset config and remix assets inspector") added an `assets` section to `remix.json` plus a `remix assets` / `remix assets inspect` CLI. **Later inverted on `preview/main` by `9696913` ("Replace assets `fileMap` with `mounts`"):** `fileMap` was removed and replaced with directory-based `mounts`. Applies when wiring the asset server in this app (or adopting the shared-config split) on a build at/after `9696913`.

## Problem

Before this feature the runtime asset server (`app/assets.ts`) hard-coded its `basePath`, file mapping, `allowFiles`, `allowPackages`, `denyFiles` inline. There was no way to ask "what is actually reachable and why?" — and any diagnostic tool was a hand-maintained guess that could drift from request handling. With `mounts`, the mapping is expressed as directory roots instead of `*path` wildcard pairs.

## Solution

### Single source of truth in `remix.json`, runtime-only options in code

Put the static mapping/access config under `remix.json → assets` and spread it into `createAssetServer` from `loadConfig` (from `remix/cli`). Keep only env/runtime behaviors (watch, hmr, fingerprint, target, sourceMaps, scripts, minify) in the code:

```ts
// app/assets.ts
import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'

const config = await loadConfig(import.meta.dirname)  // searches upward for remix.json
if (config.assets === undefined) throw new Error('Missing assets configuration in remix.json')

export const assetServer = createAssetServer({ ...config.assets, watch: isDevelopment, /* runtime opts */ })
```

`loadConfig()` accepts a config file or a directory and searches upward for `remix.json`. The module needs top-level `await` (ESM is fine here; `server.ts` already uses it).

### Debugging

- `remix assets` — lists every reachable asset as `url -> file`.
- `remix assets inspect <url-or-file>` — explains one mapping: `Status`, `URL`, `File`, and `Denied by:` when blocked.

`AssetStatus` values: `reachable | missing | denied | not-allowed | unmapped | unsupported`. `denyFiles` takes precedence over `allowFiles`/`allowPackages`; a deny match sets `access.deniedBy` to the matching pattern.

## Version-pinned gotchas (build at/after `9696913`)

1. **The `assets` parser is strict and rejects unknown properties.** In `~remix/packages/cli/src/lib/remix-config.ts` (`parseAssetsConfig`) the only allowed keys are `allowFiles`, `allowPackages`, `basePath`, `denyFiles`, `mounts`, `files`, `rootDir`. `fileMap` now throws `Unknown property "fileMap"` — **use `mounts`**. (Pre-`9696913` this was inverted: `fileMap` accepted, `mounts` rejected.)
2. **`mounts` direction:** keys are public URL path segments **relative to `basePath`** (no leading slash needed, e.g. `app`); values are directories **relative to `rootDir`** (absolute values throw). Each mount recurses, so the path beneath the root is preserved (no `*path` wildcards). When `mounts` is omitted the default is `{ app: 'app', npm: 'node_modules' }` — note the **`npm` URL key**, so node_modules files end up at `/assets/npm/...` rather than the old `/assets/node_modules/...`. To preserve the old `/assets/node_modules/<path>` URLs, use an explicit `mounts: { app: 'app', node_modules: 'node_modules' }`.
3. **`denyFiles` is path-scoped.** This app uses `["app/**/*.server.*", "app/**/*.test.*"]`. It only guards `app/**` paths, so package-internal test files under `node_modules` (e.g. `@remix-run/test/dist/test/framework.test.browser.js`) remain reachable via the `node_modules` directory mount. That is expected — do not broaden the deny to `*.test.*` globally (would block vendor package files and still not be the intent).
4. **The `node_modules` directory mount makes the whole allowed dep tree "reachable."** `remix assets` therefore dumps ~2500 lines; filter with `remix assets | grep '^/assets/app/'`. (Piping through `head`/awk truncates it and makes counts look wrong — redirect to a file for accurate counts.)
5. **`denyFiles: app/**/*.test.*` does NOT break browser tests.** Remix's browser-test runner (`@remix-run/test`) serves `*.test.browser.*` on its own dedicated HTTP server, independent of the app's `/assets` server (see `~remix/packages/test/src/app/server.ts`). So hiding app test files from the asset server is safe.

## References

- `~remix/packages/assets/README.md` — shared-config / `remix assets` docs, `loadConfig` wiring, `mounts` examples.
- `~remix/packages/cli/src/lib/remix-config.ts` — `RemixAssetsConfig`, strict property whitelist (`mounts`, not `fileMap`).
- `~remix/packages/cli/schema/remix.json` — `assets` JSON schema (`additionalProperties: false`, `mounts`).
- `~remix/packages/assets/src/lib/inspection.ts` — `AssetStatus`, `AssetKind`, `getAssets()`, `getAssetDetails()`.
- `~remix/packages/assets/src/lib/asset-server.ts` — `AssetServerOptions` (accepts `rootDir`, `basePath`, `mounts`, `allowFiles`, `allowPackages`, `denyFiles`, `files`).
- App wiring: `app/assets.ts`, `app/assets.test.ts`, `remix.json → assets`.
