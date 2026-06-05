## Why

The register dialog accepts a single password field with no confirmation, making it easy for users to create accounts with mistyped passwords. Additionally, neither the register nor the password reset dialogs provide a way to toggle password visibility, forcing users to type passwords blindly with no way to verify what they entered.

## What Changes

- Add a second "Confirm password" field to the register form that validates it matches the primary password
- Add a password visibility toggle button (eye icon) to:
  - Both password fields in the register form (password + confirm password)
  - The password field in the reset password form (at `/auth/forgotten/:token`)
- The toggle switches the input `type` between `password` and `text`

## Capabilities

### New Capabilities

- `password-confirmation-visibility`: Client-side password confirmation validation and visibility toggle UI for auth form password fields

### Modified Capabilities

- `auth-ui-restyle`: Register page password field structure changes to include a confirmation field and visibility toggles
- `password-reset`: Reset password form's password field gains a visibility toggle

## Impact

- `newapp/app/actions/auth-register/controller.tsx` — register form UI and validation schema
- `newapp/app/actions/auth-forgotten/controller.tsx` — reset password form UI
- `newapp/app/ui/auth-card.tsx` — possibly add a reusable `PasswordField` component for password inputs with visibility toggles
