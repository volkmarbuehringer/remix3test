## 1. Registration Controller

- [x] 1.1 Import `validatePasswordComplexity` and `PASSWORD_MIN_LENGTH` from `../../utils/password-complexity.ts`
- [x] 1.2 Bump schema `minLength(9)` to `minLength(PASSWORD_MIN_LENGTH)` for both `password` and `confirmPassword` fields
- [x] 1.3 Add `validatePasswordComplexity(password)` call after the password-match check, returning a 400 re-render with the error message if it fails
- [x] 1.4 Add client-side live complexity feedback `<div data-pw-complexity>` and inline `<script>` block next to the password field (matching settings-page pattern)
- [x] 1.5 Update the generic error message in the `parseSafe` failure branch to reference `PASSWORD_MIN_LENGTH` instead of hardcoded 9

## 2. Password-Reset Controller

- [x] 2.1 Import `validatePasswordComplexity` and `PASSWORD_MIN_LENGTH` from `../../utils/password-complexity.ts`
- [x] 2.2 Bump schema `minLength(9)` to `minLength(PASSWORD_MIN_LENGTH)` for both `password` and `confirmPassword` fields
- [x] 2.3 Add `validatePasswordComplexity(password)` call after the password-match check in the reset action, returning a 400 re-render with the error message if it fails
- [x] 2.4 Add client-side live complexity feedback `<div data-pw-complexity>` and inline `<script>` block next to the password field in `ResetFormPage`
- [x] 2.5 Update the error message in the `parseSafe` failure branch to reference `PASSWORD_MIN_LENGTH` instead of hardcoded 9

## 3. Verify

- [x] 3.1 Run `npm run typecheck` to verify no type errors
- [x] 3.2 Run `npm test` to confirm existing tests still pass (including `password-complexity.test.ts`)
