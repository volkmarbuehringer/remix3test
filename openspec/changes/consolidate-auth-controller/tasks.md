## 1. Create consolidated `app/actions/auth/controller.tsx`

- [x] 1.1 Import all dependencies from the 5 source controllers (deduplicating shared imports)
- [x] 1.2 Port `authLogin` from `auth-login/controller.tsx` — rename `export default` to `export const authLogin`
- [x] 1.3 Port `authRegister` and `registerSent` from `auth-register/controller.tsx` — rename default to `export const authRegister`
- [x] 1.4 Port `authForgotten` and `authForgottenReset` from `auth-forgotten/controller.tsx` — rename default to `export const authForgotten`
- [x] 1.5 Port `verify` from `auth-verify/controller.tsx` as named export
- [x] 1.6 Port `authLogout` from `auth-logout/controller.tsx` as named export
- [x] 1.7 Keep page component imports pointing to `./pages.tsx` (to be created in step 2)

## 2. Extract page components to `app/actions/auth/pages.tsx`

- [x] 2.1 Move `LoginPage` and `BrandMark` + styles from `auth-login/controller.tsx` to `pages.tsx`
- [x] 2.2 Move `RegisterPage`, `RegisterSentPage` + styles from `auth-register/controller.tsx` to `pages.tsx`
- [x] 2.3 Move `ForgotPage`, `ForgotSentPage`, `ResetFormPage`, `ResetErrorPage` + styles from `auth-forgotten/controller.tsx` to `pages.tsx`
- [x] 2.4 Move `VerifyErrorPage` + styles from `auth-verify/controller.tsx` to `pages.tsx`
- [x] 2.5 Add necessary imports to `pages.tsx` (Handle, css, theme, routes, AuthShell, etc.)

## 3. Update `app/router.ts`

- [x] 3.1 Replace 6 individual import lines with a single import from `./actions/auth/controller.tsx`
- [x] 3.2 Verify all route mappings use the new named export references

## 4. Clean up flat directories

- [x] 4.1 `git rm -r app/actions/auth-login/`
- [x] 4.2 `git rm -r app/actions/auth-register/`
- [x] 4.3 `git rm -r app/actions/auth-forgotten/`
- [x] 4.4 `git rm -r app/actions/auth-verify/`
- [x] 4.5 `git rm -r app/actions/auth-logout/`

## 5. Verify

- [x] 5.1 Run `npm run typecheck` — pass with zero errors ✓
- [x] 5.2 Run `npx remix doctor` — 6 auth warnings silenced (42→36) ✓
- [ ] 5.3 Run `npx remix test` — 36 pre-existing failures unrelated to this change (global rate limiter 429s, mail server unavailable)
- [x] 5.4 Verify `app/actions/auth/controller.tsx` exports all 7 handlers: `authLogin`, `authRegister`, `registerSent`, `verify`, `authForgotten`, `authForgottenReset`, `authLogout`
