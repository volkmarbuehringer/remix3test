## Why

The previous migration to direct context properties (`context.render`, `context.auth`, etc.) had to leave 3 files using `getContext().get(Key)` because `getContext()` returns `RequestContext<AnyParams, []>` — a context type with empty entries. All 7 remix demos solve this with a `declare module 'remix/fetch-router'` pattern that augments the global `RouterTypes` interface, making `getContext()` return the fully typed `AppContext` with all direct properties.

Adding this declaration would fully complete the direct context properties migration and align newapp with the established remix demo conventions.

## What Changes

- **Add `declare module` for `RouterTypes`** in `app/router.ts` — augments the global type so `getContext()` returns `AppContext` with all direct properties
- **Re-convert 3 reverted files** to use direct properties through `getContext()`:
  - `app/actions/auth-logout.tsx`: `getContext().get(Session)` → `getContext().session`
  - `app/utils/context.ts`: `getContext().get(Auth)` → `getContext().auth`
  - `app/utils/error-handling.ts`: `getContext().get(Session)` → `getContext().session`
- **Remove now-unnecessary context key imports** (`Session`, `Auth`) from those 3 files
- **No behavioral changes** — runtime behavior is identical; this closes the final gap in the context properties migration

## Capabilities

### New Capabilities

<!-- No new capabilities — this completes a previous refactor. -->

### Modified Capabilities

<!-- No requirement changes — existing behavior is preserved. -->

## Impact

- **4 files modified**: `app/router.ts` + 3 utility/action files
- **0 behavioral changes**: runtime output is identical
- **0 dependency changes**: no package.json modifications needed
- **3 reverted calls converted**: the final `getContext().get(Key)` holdouts become direct properties
- **1 type declaration added**: the missing `declare module` that all demos share
