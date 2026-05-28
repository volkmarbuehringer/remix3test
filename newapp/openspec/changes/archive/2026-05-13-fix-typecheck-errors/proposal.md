## Why

Newapp has 30+ typecheck errors after upgrading to the latest remix `#preview/main` build. The `ContextEntries` type changed from a tuple format `readonly [key, value]` to an object format `{ key, value, property? }`, and the `loadDatabase()` middleware still uses the old tuple format. This single incompatibility cascades through the entire type system, causing all `context.get()` lookups to fall back to their base types.

## What Changes

- **Fix `loadDatabase()` middleware type annotation** — update from old tuple format `Middleware<readonly [typeof Database, Database]>` to new object format `Middleware<{ key: typeof Database; value: Database }>`
- **Resolve cascading type failures** — the database middleware fix will unblock `RootMiddleware` → `AppContext` → all `context.get()` lookups, fixing every downstream type error without additional changes
- **No behavioral changes** — runtime behavior is identical; this is purely a type-annotation fix

## Capabilities

### New Capabilities

<!-- No new capabilities introduced — this is purely a type-system alignment fix. -->

### Modified Capabilities

<!-- No existing capabilities have their requirements changed. -->

## Impact

- **1 file modified**: `app/middleware/database.ts` — update the `Middleware` generic type parameter
- **0 behavioral changes**: runtime output is identical
- **0 dependency changes**: no package.json modifications needed
- **All 30+ type errors resolved**: typecheck returns clean after this single fix
