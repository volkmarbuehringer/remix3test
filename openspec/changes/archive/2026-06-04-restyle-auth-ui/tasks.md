## 1. Shared Auth Card Component

- [x] 1.1 Create `app/ui/auth-card.tsx` with `AuthShell` and `AuthForm` components
- [x] 1.2 Implement `AuthShell`: centered card layout with eyebrow/title/description typography, surface background, border, shadow, and `children` slot
- [x] 1.3 Implement `AuthForm`: form tag, `CsrfTokenInput`, conditional error banner (danger colors, `role="alert"`), `children` slot for fields, full-width primary submit `Button`, optional `footer` slot
- [x] 1.4 Define `AuthFormErrors` type (`{ form?: string; [field: string]: string | undefined }`) for the `errors` prop (forward-compatible, not wired yet)
- [x] 1.5 Use newapp theme tokens (not hardcoded values) for all colors, spacing, borders, shadows

## 2. Restyle Login Controller

- [x] 2.1 Replace the `LoginPage` component body with `AuthShell` + `AuthForm` using the card layout
- [x] 2.2 Move brand mark (dot + "newapp" label) inside the card above the title
- [x] 2.3 Set eyebrow="Welcome back", title="Sign in to newapp", description="Use your email and password to continue."
- [x] 2.4 Render email and password inputs as children of `AuthForm` using `input.base`/`input.focus` mixins
- [x] 2.5 Pass `error` prop to `AuthForm` for auth/rate-limit/format errors
- [x] 2.6 Preserve `returnTo` parameter in form action URL
- [x] 2.7 Move demo account hints into `footer` prop of `AuthForm`, inside the card
- [x] 2.8 Move "Don't have an account? Register here" link into `footer` prop below demo hints
- [x] 2.9 Remove old page-level CSS definitions (errorPanelCss, formStackCss, fieldLabelCss, submitBtnCss, brandMarkCss, brandDotCss, brandLabelCss, headingCss, errorBannerCss, demoBoxCss) — styles are now in `auth-card.tsx`

## 3. Restyle Register Controller

- [x] 3.1 Replace the `RegisterPage` component body with `AuthShell` + `AuthForm` using the card layout
- [x] 3.2 Set eyebrow="Get started", title="Create your account", description="Fill in your details to create a new account."
- [x] 3.3 Render name, email, and password inputs as children of `AuthForm` using `input.base`/`input.focus` mixins
- [x] 3.4 Pass `error` prop to `AuthForm` for validation/duplicate-email/rate-limit errors
- [x] 3.5 Move "Already have an account? Login here" link into `footer` prop
- [x] 3.6 Remove old page-level CSS definitions (errorPanelCss, formStackCss, fieldLabelCss, submitBtnCss)

## 4. Verification

- [x] 4.1 Run `npm run typecheck` and fix any type errors
- [x] 4.2 Run `npm test` and ensure no regressions
- [x] 4.3 Manually verify: `GET /login` renders centered card with brand mark, email/password fields, demo hints
- [x] 4.4 Manually verify: `GET /register` renders centered card with name/email/password fields
- [x] 4.5 Manually verify: Submit login with invalid credentials shows danger-colored error banner
- [x] 4.6 Manually verify: Submit registration with duplicate email shows error banner
- [x] 4.7 Manually verify: Successful login redirects to home page
- [x] 4.8 Manually verify: Successful registration creates user and redirects to home page
- [x] 4.9 Manually verify: Toggle dark theme — card adapts to dark palette
