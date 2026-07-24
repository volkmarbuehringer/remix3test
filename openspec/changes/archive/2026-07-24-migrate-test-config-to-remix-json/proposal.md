# Migrate test config from `remix-test.config.ts` to `remix.json`

## Problem

Upstream Remix commit 08df6ebe0 replaced file-based config loading with static `remix.json` CLI configuration. The `loadConfig()` function was removed; `resolveConfig()` no longer reads `remix-test.config.ts`. Tests fail with `DATABASE_URL` not set because `globalSetup` never runs — the `setup` field from the old config file is silently ignored.

## Proposed change

1. Create `remix.json` at project root with the test config
2. Extract inline Playwright config to `playwright.config.ts`
3. Remove `remix-test.config.ts`
4. `npm test` passes again

## Out of scope

- Database lifecycle API migration (can be done separately)
- `module.register()` deprecation warning (upstream issue)
