## Why

`remix doctor` emits 42 warnings for `app/actions/` — the largest cluster is 6 auth-related controllers scattered across flat kebab-case directories (`auth-login/`, `auth-register/`, `auth-forgotten/`, etc.) plus a near-empty `auth/` directory with only test files. The timeboxer demo at `~/remix/demos/timeboxer` shows the intended pattern: a single `auth/controller.tsx` exporting all sub-route handlers. This spike consolidates just the auth routes to validate the approach before rolling it to `admin/*`, `ai/*`, `verwaltung/*` sub-routes.

## What Changes

- Merge 5 flat controller dirs into `app/actions/auth/controller.tsx`:
  - `auth-login/controller.tsx` → named export `authLogin`
  - `auth-register/controller.tsx` → named exports `authRegister`, `registerSent`
  - `auth-forgotten/controller.tsx` → named exports `authForgotten`, `authForgottenReset`
  - `auth-verify/controller.tsx` → named export `verify`
  - `auth-logout/controller.tsx` → named export `authLogout`
- Extract page components to `app/actions/auth/pages.tsx` (following timeboxer convention)
- Update `app/router.ts` to import all auth handlers from a single path
- Delete the 5 flat directories
- Verify: `npm run typecheck`, `npx remix doctor` (auth warnings gone), `npx remix test`

## Capabilities

### New Capabilities

- `auth-controller-consolidation`: Controller colocation pattern for auth routes — single directory, multiple named exports from one controller file, pages extracted to co-located module

### Modified Capabilities

<!-- No requirement-level changes — pure structural refactor -->

## Impact

- `app/actions/auth/controller.tsx` — new file (merged from 5 sources)
- `app/actions/auth/pages.tsx` — new file (extracted page components)
- `app/router.ts` — update 6 import lines to a single import
- 5 directories deleted: `auth-login/`, `auth-register/`, `auth-forgotten/`, `auth-verify/`, `auth-logout/`
- ~8 `remix doctor` warnings silenced
- Zero behavioral changes — all routes continue to work identically
