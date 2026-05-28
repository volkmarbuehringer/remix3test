## Why

The latest remix middleware now installs values as direct properties on the request context (`context.auth`, `context.session`, `context.formData`, `context.render`) alongside the traditional `context.get(Key)` API. `newapp` still uses the old `.get()` pattern across ~35 call sites, making the code more verbose than necessary. The `loadDatabase()` middleware doesn't install a direct property at all, so `context.db` isn't available. Auth controllers also mix `context` parameter usage with `getContext()` calls inconsistently.

## What Changes

- **Add `property: 'db'` to `loadDatabase()`** — enables `context.db` alongside `context.get(Database)`
- **Replace `context.get(Renderer)` with `context.render`** — 16 call sites across controllers and admin middleware
- **Replace `context.get(Auth)` with `context.auth`** — 6 call sites across controllers and middleware
- **Replace `context.get(Session)` / `getContext().get(Session)` with `context.session`** — 4 call sites
- **Replace `context.get(FormData)` with `context.formData`** — 7 call sites
- **Unify `getContext()` vs `context` patterns in auth controllers** — consistently use the action's `context` parameter instead of mixing in `getContext()`
- **Remove unnecessary `!` non-null assertions** — 5 in `controller.tsx` once types resolve correctly
- **No behavioral changes** — runtime behavior is identical; this is purely a readability/consistency refactor

## Capabilities

### New Capabilities

<!-- No new capabilities — this is a code-style refactor with no behavioral changes. -->

### Modified Capabilities

<!-- No requirement changes — existing behavior is preserved. -->

## Impact

- **~18 files modified**: controllers, middleware, utilities
- **0 behavioral changes**: runtime output is identical
- **0 dependency changes**: no package.json modifications needed
- **~35 call sites simplified**: `context.get(Key)` → direct property access
- **5 `!` assertions removed**: no longer needed with correct types
