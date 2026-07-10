## Why

The newapp project uses Playwright for browser-based tests (`@playwright/test`, `playwright` in devDependencies) but lacks automated Playwright browser installation. Without a postinstall script, developers must install Playwright browsers manually after each `pnpm install`. The Remix monorepo at `~/remix` has a robust postinstall script that handles this automatically, including retry logic and partial-install cleanup.

The old postinstall (oxlint bindings + node-tsx patch) has been removed as it's no longer necessary.

## What Changes

- Copy and adapt `~/remix/scripts/postinstall.ts` to `newapp/scripts/postinstall.ts`
- Add a `"postinstall": "node ./scripts/postinstall.ts"` script to `newapp/package.json`
- Remove the old `scripts/install-oxc-bindings.mjs` and `scripts/patch-node-tsx.mjs` files
  Keep the `scripts/oxlint-plugins/` directory — these are custom oxlint JS plugins still referenced in `.oxlintrc.json`.

The adapted script will install Playwright browsers (chromium, firefox --only-shell) for the newapp project's Playwright setup.

## Capabilities

### New Capabilities

- `playwright-browsers`: Automated Playwright browser installation on `pnpm install`, with retry logic, timeout, signal handling, and partial-install cleanup.

### Modified Capabilities

- None

## Impact

- `newapp/scripts/postinstall.ts` — new file (adapted from `~/remix/scripts/postinstall.ts`)
- `newapp/package.json` — add `postinstall` script entry
- `newapp/scripts/install-oxc-bindings.mjs` — removed
- `newapp/scripts/patch-node-tsx.mjs` — removed
- `newapp/scripts/oxlint-plugins/` — kept (still used by oxlint config)
