## Why

The compliance audit identified three gaps between `newapp` and Remix 3 security and quality standards. The app uses session cookies with mutation endpoints but has no CSRF protection, does not regenerate session IDs on login/logout (session fixation vector), and the `requireAdmin()` middleware returns a hardcoded HTML string with inline styles instead of using the mandated `css()` mixin system. These are well-understood, contained fixes that close real security and quality gaps.

## What Changes

- **CSRF protection**: Add `csrf()` middleware from `remix/csrf-middleware` to the middleware chain, and integrate CSRF tokens into mutation forms (the `RestfulForm` component).
- **Session regeneration on auth events**: Call `session.regenerate()` in the login controller after successful authentication and in the logout handler before destroying the session. Prevents session fixation.
- **`requireAdmin()` response quality**: Replace the hardcoded HTML string in `app/middleware/admin.ts` with a proper Remix component rendered through the existing renderer, using `css()` mixins and theme tokens.

## Capabilities

### New Capabilities

- `csrf-protection`: Cross-Site Request Forgery protection for the middleware chain and form system
- `session-security`: Session regeneration on login and logout to prevent session fixation attacks
- `error-response-standards`: Proper Remix component rendering for auth-related error responses (403 pages), using `css()` mixins and theme tokens

### Modified Capabilities

_(None — no existing specs have requirement changes)_

## Impact

- **Dependencies**: `remix/csrf-middleware` will be added (already part of `remix` package, just needs import)
- **Files**:
  - `app/router.ts` — add CSRF middleware to chain
  - `app/ui/restful-form.tsx` — optionally integrate CSRF token into forms
  - `app/actions/auth-login-controller.tsx` — add `session.regenerate()` before `session.set('auth')`
  - `app/actions/auth-logout.tsx` — add `session.regenerate()` before destroying session
  - `app/middleware/admin.ts` — replace inline HTML response with component-based rendering
