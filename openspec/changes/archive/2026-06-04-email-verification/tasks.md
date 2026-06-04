## 1. Dependencies and Configuration

- [x] 1.1 Install nodemailer and @types/nodemailer
- [x] 1.2 Add SMTP_HOST, SMTP_PORT, SMTP_FROM env vars to .env and .env.example

## 2. Database Schema

- [x] 2.1 Add email_verified (integer), verification_token (text), verification_expires (integer) columns to users table in app/data/schema.ts
- [x] 2.2 Add beforeWrite defaults: email_verified=0 on create, null token/expiry on create
- [x] 2.3 Add afterRead parseIntFields for email_verified and verification_expires
- [x] 2.4 Create migration SQL and apply it to the database

## 3. Utilities

- [x] 3.1 Create app/utils/verification-token.ts with generateToken() using crypto.getRandomValues (32 bytes, base64url)
- [x] 3.2 Create app/utils/send-email.ts with sendVerificationEmail() function that composes HTML + plain text using remix/html-template and routes.href()

## 4. Mailer Middleware

- [x] 4.1 Create app/middleware/mailer.ts with mailer() middleware that creates nodemailer transport from env and sets context.mailer.sendEmail()
- [x] 4.2 Register mailer() middleware in app/middleware/root.ts after loadDatabase() and before render()

## 5. Routes

- [x] 5.1 Add verify: get('/verify/:token') to auth route in app/routes.ts

## 6. Registration Controller Updates

- [x] 6.1 Update register action: generate token, create user without auto-login, call sendVerificationEmail(), redirect to verifySent page instead of home
- [x] 6.2 Add verifySent action to register controller that renders a "check your email" success page
- [x] 6.3 Update rate limiter to allow re-submission (currently blocks on duplicate email, which is now the normal pre-verification state)

## 7. Verification Controller

- [x] 7.1 Create app/actions/auth-verify/controller.tsx with verify action: find user by token, check expiry, mark verified, clear token, flash success, redirect to login
- [x] 7.2 Wire verify controller in app/router.ts
- [x] 7.3 Render error page for expired/invalid tokens with user-friendly messages

## 8. Auth Middleware Changes

- [x] 8.1 Update session auth scheme verify() in app/middleware/auth.ts: admin users skip email_verified check; non-admin users require email_verified = true

## 9. Seed Data

- [x] 9.1 Update seed data in app/data/seed.ts to set email_verified = true for existing admin users

## 10. Tests

- [x] 10.1 Update existing registration tests in app/actions/auth-register/controller.test.ts: success now redirects to verifySent, not home; no auto-login
- [x] 10.2 Add test: verification with valid token marks user as verified and redirects to login with flash
- [x] 10.3 Add test: verification with expired token returns 400 with "expired" message
- [x] 10.4 Add test: verification with invalid token returns 400 with "invalid" message
- [x] 10.5 Add test: unverified user cannot log in (returns same error as wrong credentials)
- [x] 10.6 Add test: verified user can log in successfully
- [x] 10.7 Add test: admin user can log in regardless of email_verified
- [x] 10.8 Add test: GET verifySent renders success page with login link
- [x] 10.9 Add test: mailer middleware sets up transport from env config
- [x] 10.10 Add test: generateToken produces unique, 43-character base64url strings
- [x] 10.11 Run full test suite and verify all tests pass
