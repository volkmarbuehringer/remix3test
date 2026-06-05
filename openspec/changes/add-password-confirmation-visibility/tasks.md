## 1. PasswordField Component

- [x] 1.1 Create `PasswordField` clientEntry component in `app/ui/auth-card.tsx` with password input, visibility toggle button, eye/eye-off inline SVG icons, label, and optional error display
- [x] 1.2 Export `PasswordField` from `app/ui/auth-card.tsx` alongside existing `AuthShell`, `AuthForm`, `fieldLabelCss`, `fieldErrorCss`
- [x] 1.3 Add inline SVG eye/eye-off icon paths as constants at module level

## 2. Register Page Changes

- [x] 2.1 Import `PasswordField` in `app/actions/auth-register/controller.tsx`
- [x] 2.2 Replace the plain password `<input>` with `<PasswordField name="password" label="Password" ...>`
- [x] 2.3 Add `<PasswordField name="confirmPassword" label="Confirm password" ...>` below the password field
- [x] 2.4 Add client-side password matching logic in `RegisterPage` — show error when passwords differ, prevent form submission when mismatched

## 3. Reset Password Page Changes

- [x] 3.1 Import `PasswordField` in `app/actions/auth-forgotten/controller.tsx`
- [x] 3.2 Replace the plain password `<input>` in `ResetFormPage` with `<PasswordField name="password" label="New password" ...>`

## 4. Validation

- [x] 4.1 Verify server-side validation continues to work (password minLength 8, email format) with the new PasswordField component
- [x] 4.2 Verify `typecheck` passes with no errors
- [x] 4.3 Verify existing tests pass (`npm test`)
