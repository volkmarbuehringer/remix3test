## Why

The newapp has several auth gaps and inconsistencies discovered during a codebase audit. The `/client/*` routes have zero authentication, two different `requireAuth` functions exist with different behavior, the login controller bypasses the `completeAuth()` utility, and session regeneration calls are inconsistent across login/logout. These issues create security risk (unauthenticated CRUD on /client/*) and maintenance burden (divergent auth patterns).

## What Changes

1. **Add auth middleware to `/client/*`** — Protect all client CRUD routes behind `requireAuth()` to match the pattern used by AI and admin controllers.
2. **Convert lists routes to middleware-based auth** — Split `lists` and `listsShow` out of the main controller into their own controller with `requireAuth()` middleware, replacing the ad-hoc inline `requireAuth()` function.
3. **Use `completeAuth()` in login controller** — Replace the manual `context.session` + `session.regenerateId(true)` block with the standard `completeAuth()` utility from `remix/auth`.
4. **Align `session.regenerateId()` usage** — Make logout also pass `true` to `regenerateId` so both login and logout consistently persist the new session ID immediately.

## Capabilities

### New Capabilities

- `auth-policy`: Defines which routes require authentication and how auth enforcement is applied at the controller and action level.

### Modified Capabilities

_(none — no existing specs to modify)_

## Impact

- `app/actions/client/controller.tsx` — add `requireAuth()` to middleware array
- `app/actions/controller.tsx` — remove inline `requireAuth()` function; extract lists routes to their own controller (new file `app/actions/lists/controller.tsx`)
- `app/app/router.ts` — map lists routes to new controller
- `app/actions/auth-login-controller.tsx` — use `completeAuth()` from `remix/auth`
- `app/actions/auth-logout.tsx` — add `true` to `session.regenerateId()`
- No new dependencies
- No breaking API changes
