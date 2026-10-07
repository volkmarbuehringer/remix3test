## Why

The Remix upstream repo recently tightened lint conventions: lint warnings now fail the build (`--max-warnings=0`), and `.oxlintrc.json` category rules were made fully explicit. This app's lint config is a stale copy that should be kept in sync.

## What Changes

- **`package.json`**: Add `--max-warnings=0` to both `lint` and `lint:fix` scripts
- **`.oxlintrc.json`**: Add explicit `"off"` for all rule categories (nursery, pedantic, perf, restriction, style, suspicious); remove stale remix-specific `ignorePatterns` entries that don't apply to this app

## Capabilities

### New Capabilities

- `lint-config`: Upstream-aligned lint configuration for the app

### Modified Capabilities

None.

## Impact

- `package.json` — lint script flags
- `.oxlintrc.json` — category configuration and ignore patterns
