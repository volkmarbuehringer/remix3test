## Why

newapp's controllers handle form validation with two inconsistent patterns:

```
parseSafe (8 controllers)              parse + try/catch (5 controllers)
─────────────────────────              ──────────────────────────────
let r = s.parseSafe(schema, data)      try {
if (!r.success) {                        s.parse(schema, data)
  /* per-field errors */              } catch {
  return context.render(...)             /* generic error message */
}                                        return context.render(...)
                                      }
```

Three controllers even call `s.parse()` **without any error handler** — a `ValidationError` propagates as an unhandled 500. This inconsistency means:
- Half the controllers lose field-level error information on validation failure
- Three controllers have latent crash bugs on bad input
- New contributors don't know which pattern to follow

Timeboxer-demo uses `parseSafe` exclusively — it's the canonical Remix 3 pattern for form validation. The discriminated union (`{ success: true, value } | { success: false, issues }`) gives TypeScript narrower types and preserves structured error messages from the schema.

## What Changes

- Replace all `s.parse()` + `try/catch` with `s.parseSafe()` + discriminated union in 5 controllers:
  - `auth-login-controller.tsx`
  - `auth-register-controller.tsx`
  - `admin-users-controller.tsx`
  - `lists-controller.tsx`
  - `workflow-controller.tsx`
- Fix 3 controllers with `s.parse()` and no error handler (latent bugs):
  - `agent-controller.tsx`
  - `chat-controller.tsx`
  - `admin-messages-controller.tsx`
- Upgrade 2 controllers from `parseSafe` with generic errors to use `issuesToFieldErrors`:
  - `appointtype-controller.tsx`
  - `appointment-controller.tsx`
- All new `parseSafe` call sites use the existing `issuesToFieldErrors()` utility from `app/utils/schema-utils.ts`

## Capabilities

### Modified Capabilities
- `parse-safe-consistency`: All form-validation controllers use `s.parseSafe()` exclusively, returning structured field-level errors via `issuesToFieldErrors()` on validation failure. No controller uses `s.parse()` for form validation or leaves validation errors unhandled.

## Impact

- Modified: 10 controller files under `app/actions/`
- No changes to routes, middleware, database schema, or UI components
- Existing `issuesToFieldErrors` utility reused without modification
- Behavior preserved: controllers return the same HTTP status codes and error messages; only the *type* of error information improves (structured vs generic)
- Bugs fixed: 3 controllers gain proper error handling for validation failures
