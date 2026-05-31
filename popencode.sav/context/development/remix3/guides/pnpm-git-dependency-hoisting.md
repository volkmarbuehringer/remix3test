# PNPM Hoisting for Git-Hosted Remix Dependencies

## Problem

When Remix 3 is installed via a git URL (e.g., `github:remix-run/remix#preview/main&path:packages/remix`), pnpm treats the `@remix-run/*` sub-packages as transitive dependencies from a non-workspace source. By default, pnpm does **not** hoist these to the top-level `node_modules/`.

This causes the asset server (`remix/assets`) to fail because:

1. The remix package's `dist/*.js` files re-export from `@remix-run/*` (e.g., `export * from '@remix-run/ui'`)
2. The asset server's `enhanced-resolve` resolver (with `symlinks: false`) walks up from the realpath inside `.pnpm/` looking for `node_modules/@remix-run/<pkg>`
3. `.pnpm/` paths don't match the fileMap pattern `node_modules/*path`
4. Result: `IMPORT_RESOLUTION_FAILED` — the import can't be resolved to a file within the asset server's fileMap

## Fix

Create `.npmrc` in the project root with:

```ini
public-hoist-pattern[]=@remix-run/*
```

This tells pnpm to hoist all `@remix-run/*` packages to `node_modules/@remix-run/*` as symlinks pointing into the `.pnpm` store.

After adding or changing `.npmrc`, reinstall:

```sh
pnpm install
```

## Verification

```sh
ls node_modules/@remix-run/ui
# Should show: dist/  LICENSE  package.json  README.md  src/
```

If the directory doesn't exist or shows broken symlink targets, hoisting isn't working.

## Why It Works

With hoisting enabled:

```
entry.tsx → import from 'remix/ui/animation'
                ↓
node_modules/remix/dist/ui/animation.js
  (export * from '@remix-run/ui/animation')
                ↓ (resolver walks up from remix/dist/)
node_modules/@remix-run/ui/animation → ✅ FOUND
                ↓ (matches fileMap node_modules/*path)
           SERVED
```

Without hoisting, `@remix-run/ui` lives only inside `.pnpm/`:

```
.pnpm/@remix-run+ui@.../node_modules/@remix-run/ui/...
                ↓
relative path from root: node_modules/.pnpm/.../node_modules/@remix-run/ui/...
                ↓ ❌ doesn't start with node_modules/
           FILE_MAP_MISMATCH
```

## Scope

This affects all `@remix-run/*` packages that the remix meta-package re-exports:

- `@remix-run/ui` (most commonly hit — used by app entry + assets)
- `@remix-run/fetch-router`
- `@remix-run/data-table`
- `@remix-run/auth-middleware`
- `@remix-run/session`
- `@remix-run/cookie`
- `@remix-run/test`
- `@remix-run/assert`
- ... and all others listed in the remix package manifest

The `.npmrc` `public-hoist-pattern` covers all of them with a single pattern.

## Caveats

- **Never remove `.npmrc`** — the hoisting config is required. Reinstalling without it will break the asset server.
- **Not needed with npm or yarn** — this is specific to pnpm's strict store layout.
- **Not needed with workspace monorepos** — if the `@remix-run/*` packages are in a `packages/` directory with workspace protocol, they're resolved directly from disk, not through `.pnpm/`.
