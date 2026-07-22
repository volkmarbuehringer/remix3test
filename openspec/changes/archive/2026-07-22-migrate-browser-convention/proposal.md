## Why

The app has 32 clientEntry components all dumped in `app/assets/`, separated from the server code they belong to. This forces developers to jump between directories to understand a feature end-to-end. The `.browser.` naming convention (mirroring the existing `denyFiles: ['**/*.server.*']` and `*.test.browser.*` test patterns) lets us co-locate clientEntry components next to their server counterparts, making feature ownership clearer.

Also, the current `allowFiles` is overly broad (`app/ui/**`, `app/utils/**`), which means any file accidentally placed there gets served to the client. Tightening `allowFiles` to only `**/*.browser.*` paths would make the client bundle boundary explicit and auditable.

## What Changes

- Rename all clientEntry source files from `<name>.tsx` to `<name>.browser.tsx`
- Move them from `app/assets/` into the directory of the server code they enhance
- Update `app/assets.ts` to narrow `allowFiles` to only `.browser.` files and `entry.tsx`
- Update all imports across action controllers and page modules
- No breaking API changes — pure file relocation and rename

## Capabilities

### New Capabilities

- `browser-file-convention`: naming convention for client-side interactive components

### Modified Capabilities

<!-- No existing spec changes — this is infrastructure/architecture only -->

## Impact

- `app/assets/` directory shrinks to just `entry.tsx` (the client boot script)
- 32 `clientEntry` components renamed and relocated
- `app/assets.ts` `allowFiles` pattern changes
- Every action controller that imports from `app/assets/` gets updated import paths
- No runtime behavior changes — all existing tests should pass unchanged
