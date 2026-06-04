## 1. Schema & Routes

- [x] 1.1 Add `password_reset_token` (text) and `password_reset_expires` (integer) columns to the `users` table in `app/data/schema.ts`
- [x] 1.2 Add `auth.forgotten` form route and `auth.forgottenReset` get route in `app/routes.ts`

## 2. Utilities

- [x] 2.1 Add `sendPasswordResetEmail` function to `app/utils/send-email.ts` (reusing `remix/html-template` for HTML email, 1-hour expiry note)
- [x] 2.2 Add `resetExpires()` helper function to `app/utils/verification-token.ts` (returns now + 1 hour)

## 3. Controller

- [x] 3.1 Create `app/actions/auth-forgotten/controller.tsx` with:
  - GET `/auth/forgotten` → render email entry form
  - POST `/auth/forgotten` → validate email, generate token, send reset email, show success page (no user enumeration)
  - GET `/auth/forgotten/:token` → validate token, render new password form
  - POST `/auth/forgotten/:token` → validate password, update hash, clear token, redirect to login with flash message
  - Rate limiting on POST `/auth/forgotten` (IP-based, 5 per 15 min)
  - Error handling: expired token, invalid token, already used token, short password

## 4. Login Page UI

- [x] 4.1 Add "Forgot password?" link below the password input on the login page in `app/actions/auth-login/controller.tsx`

## 5. Tests

- [x] 5.1 Create `app/actions/auth-forgotten/controller.test.ts` covering:
  - GET `/auth/forgotten` renders the form
  - POST `/auth/forgotten` with valid email returns success page
  - POST `/auth/forgotten` with non-existing email returns same success page (no enumeration)
  - POST `/auth/forgotten` with invalid email format returns validation error
  - POST `/auth/forgotten` rate limited after 5 requests
  - GET `/auth/forgotten/:token` with valid token renders reset form
  - POST `/auth/forgotten/:token` with valid token and password updates password and redirects
  - GET `/auth/forgotten/:token` with expired token shows error
  - GET `/auth/forgotten/:token` with invalid token shows error
  - POST `/auth/forgotten/:token` with short password shows validation error
  - POST `/auth/forgotten/:token` with already-used token shows error
