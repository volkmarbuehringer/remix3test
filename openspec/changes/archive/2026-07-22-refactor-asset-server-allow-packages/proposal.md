## Why

The upstream `remix/assets` package just added an `allowPackages` option (#11480) that lets you name specific npm packages the asset server can resolve, replacing the blanket `node_modules/**` wildcard. Currently `app/assets.ts` opens the entire `node_modules/` tree, which is broader than needed — only the `remix` package is imported by client-facing code.

## What Changes

- Add `allowPackages: ['remix']` to `createAssetServer()` options
- Remove `'node_modules/**'` from the `allow` array
- Remove `'node_modules/*path'` from the `fileMap` (no longer needed when using `allowPackages`)
- Optionally migrate to the newly introduced `allowFiles`/`denyFiles` option names

## Capabilities

### New Capabilities

None — existing capability unchanged, only the access control mechanism narrows.

### Modified Capabilities

None — spec-level behavior is unaffected.

## Impact

- `app/assets.ts` — config change only
- Asset server will reject client imports from any npm package other than `remix`
- No behavioral change for existing routes or components
