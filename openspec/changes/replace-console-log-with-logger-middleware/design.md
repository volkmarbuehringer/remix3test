## Context

The app already has `remix/middleware/logger` installed in the middleware stack (`app/middleware/root.ts`). The `Logger` symbol is available via `context.get(Logger)` in any action handler. The `lists/controller.tsx` already demonstrates the pattern: `context.get(Logger)?.(message)`.

Six server-side files use raw `console.*` calls. A standalone `userLogger` utility in `app/utils/logger.ts` also wraps `console.*` and is used by `ai/controller.tsx`. These should all converge on `context.get(Logger)`.

## Goals / Non-Goals

**Goals:**

- Every server-side log/warn/error call uses `context.logger` from the middleware
- Remove the `userLogger` utility and its imports from `ai/controller.tsx`
- Clean up raw `console.warn` in `middleware/root.ts` and `middleware/global-rate-limit.ts`
- Tests in `middleware/root.test.ts` adapt to the cleaned-up middleware

**Non-Goals:**

- Client-side `console.*` calls in `app/ui/` or `app/assets/` (browser-only)
- Changes to the `skipAssetsLogger` middleware's asset-skipping logic
- Adding structured error reporting or external log shipping

## Decisions

1. **Pattern: `context.get(Logger)?.(message)` not `context.logger`**
   - The middleware sets `Logger` as a context property with name `logger`, but accessing it via `context.get(Logger)` is the type-safe approach already used in `lists/controller.tsx`. Keep this pattern.
   - Rationale: Consistent with existing usage, no new abstractions needed.

2. **`userLogger` removal strategy**
   - In `ai/controller.tsx`, replace `userLogger('Chat')` calls with `context.get(Logger)?.()` — the middleware logger is request-scoped and already available in all action handlers.
   - The user-context prefix (`[Chat] [user:123]`) is useful but the middleware logger doesn't natively prefix by user. Since `ai/controller.tsx` action handlers have access to `context.auth`, include the user id in the log message explicitly: `context.get(Logger)?.(`[Chat] [user:${context.auth.user.id}] message`)`.

3. **`middleware/root.ts` and `global-rate-limit.ts`**
   - These have access to `context` in their middleware functions, so use `context.get(Logger)` instead of `console.warn`.
   - In `skipAssetsLogger`, the asset error warning should use `context.get(Logger)`.

## Risks / Trade-offs

- **[Context availability]** Middleware files run before `asyncContext` is fully set up — verify `context.get(Logger)` is available in `global-rate-limit.ts` before use.
  → Mitigation: The logger middleware runs before `globalRateLimit` in the middleware stack, so `Logger` is available.
- **[Test brittleness]** Tests that mock `console.log` directly may need updates.
  → Mitigation: Update `middleware/root.test.ts` to verify via context rather than console mocking.
