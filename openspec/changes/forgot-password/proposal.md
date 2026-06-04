## Why

Users who forget their password currently have no self-service recovery path. They must contact an admin to reset their password, which creates friction and support burden. This is a standard auth feature expected in any application with login.

## What Changes

- Add a "Forgot password?" link on the login page
- Add a `/auth/forgotten` route with a form where users enter their email
- On submission, generate a reset token, store it on the user record with a 1-hour expiry, and send a password reset email
- Add a `/auth/forgotten/:token` route where users set a new password (validates token, updates password, clears token)
- Add a password reset email template to the existing email utility
- Add `password_reset_token` and `password_reset_expires` columns to the users table

## Capabilities

### New Capabilities

- `password-reset`: Self-service password recovery flow including forgot-password form, reset token generation and email delivery, and secure password reset via token

### Modified Capabilities

<!-- No existing spec requirements are changing. The new feature uses the existing transactional-email infrastructure without modifying its requirements. -->

## Impact

- **Routes**: New `auth.forgotten` form route and `auth.forgottenReset` get route in `app/routes.ts`
- **Controller**: New `app/actions/auth-forgotten/controller.tsx` with forgot-password form and reset-password form
- **Schema**: `users` table gains `password_reset_token` (text) and `password_reset_expires` (integer) columns
- **Email**: New `sendPasswordResetEmail` function in `app/utils/send-email.ts`
- **UI**: "Forgot password?" link added below the password field on the login page
- **Dependencies**: None new — uses existing `nodemailer`, `remix/html-template`, `crypto.getRandomValues`, and `password-hash`
