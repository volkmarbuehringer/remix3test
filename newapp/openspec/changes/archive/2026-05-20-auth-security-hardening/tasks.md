## 1. CSRF Protection

- [x] 1.1 Import `csrf` from `remix/csrf-middleware` and add `csrf()` to the middleware chain in `app/router.ts`, placed after `session()` and before `asyncContext()`
- [x] 1.2 Update `app/ui/restful-form.tsx` to include the CSRF token as a hidden input field in forms that use POST/PUT/DELETE methods
- [x] 1.3 Update `app/actions/auth-login-controller.tsx` form to include CSRF token (POST form)
- [x] 1.4 Update `app/actions/auth-register-controller.tsx` form to include CSRF token (POST form)
- [x] 1.5 Update `app/ui/layout.tsx` logout form to include CSRF token (POST form)
- [x] 1.6 Verify CSRF middleware rejects requests with missing or invalid tokens by running existing tests

## 2. Session Security

- [x] 2.1 Add `session.regenerateId()` call before `session.set('auth', ...)` in `app/actions/auth-login-controller.tsx` on successful login
- [x] 2.2 Confirm `app/actions/auth-logout.tsx` already calls `session.regenerateId(true)` (verification — already implemented)
- [x] 2.3 Run existing auth controller tests to confirm session regeneration doesn't break login/logout flow

## 3. Error Response Standards

- [x] 3.1 Create `app/ui/forbidden-page.tsx` with a reusable `ForbiddenPage` component using `css()` mixins and theme tokens (no inline styles or `className`)
- [x] 3.2 Replace the hardcoded HTML fallback in `app/middleware/admin.ts` (lines 48-70) with renderer-based rendering using the new `ForbiddenPage` component, using `context.get(Renderer)` (already accessible)
- [x] 3.3 Remove unused `html` import from `app/middleware/admin.ts` after the hardcoded HTML is removed
- [x] 3.4 Run existing admin controller tests to confirm requireAdmin still works correctly

## 4. Verification

- [x] 4.1 Run `tsc --noEmit` to confirm no type errors
- [x] 4.2 Run `remix test` to confirm all existing tests pass
