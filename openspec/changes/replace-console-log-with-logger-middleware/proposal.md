## Why

The app has `remix/middleware/logger` installed and used in middleware/root.ts, but several server-side controllers and utilities still use raw `console.log`/`console.warn`/`console.error`. This bypasses the structured logger — meaning no consistent formatting, no request context, and no easy filtering. The `userLogger` utility in `app/utils/logger.ts` also wraps raw `console.*` calls and can be eliminated in favor of the middleware logger.

## What Changes

- Replace all server-side `console.error`/`console.warn` calls in controllers with `context.get(Logger)?.()`
- Remove the `app/utils/logger.ts` utility and migrate its callers (`ai/controller.tsx`) to use `context.logger`
- Clean up the `skipAssetsLogger` middleware in `app/middleware/root.ts` to use `context.get(Logger)` instead of raw `console.warn`
- Clean up the raw `console.warn` in `app/middleware/global-rate-limit.ts`

## Capabilities

### New Capabilities

- `server-logger-migration`: Replace all server-side raw console calls with `context.logger` from `remix/middleware/logger`, and remove the deprecated `userLogger` utility.

### Modified Capabilities

- `catch-error-logging`: Expanded scope — already specifies `context.logger` for catch blocks; this change extends the same pattern to all server-side console calls.

## Impact

- `app/actions/auth/controller.tsx` — 2 console.error calls
- `app/actions/admin/controller.tsx` — 1 console.error call
- `app/actions/verwaltung/controller.tsx` — 4 console.error calls
- `app/actions/nutzer/controller.tsx` — 2 console.error calls
- `app/actions/ai/controller.tsx` — 6 userLogger calls to migrate
- `app/utils/logger.ts` — entire file to remove
- `app/middleware/root.ts` — 1 raw console.warn
- `app/middleware/global-rate-limit.ts` — 1 raw console.warn
- `app/middleware/root.test.ts` — may need test updates
