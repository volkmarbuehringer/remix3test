## Why

The current newapp login and register pages lack the clean, centered-card visual design from the timeboxer-demo. Timeboxer's auth UI uses a polished `AuthShell` → `AuthForm` pattern with eyebrow/title/body typography, a 420px centered card with shadow, and clear error handling. This provides a better user experience for the auth flow.

## What Changes

- Restyle the login page (`auth-login-controller.tsx`) to use a centered card layout with eyebrow/title/body typography matching timeboxer's design
- Restyle the register page (`auth-register-controller.tsx`) similarly
- Create a shared `app/ui/auth-card.tsx` containing reusable `AuthShell` and `AuthForm` components (adapted from timeboxer's `pages.tsx`)
- Adapt the timeboxer design for dark theme support using newapp's existing theme tokens
- Preserve all existing functional behavior: email-based auth, rate limiting, demo account hints, CSRF via `CsrfTokenInput`, name field on register

## Capabilities

### Modified Capabilities

- `auth-ui-restyle`: Login and register pages adopt a centered-card visual design with eyebrow/title/body typography pattern, shared auth card components, and dark theme support — while preserving all existing auth behavior, validation, and rate limiting.

## Impact

- New shared component: `app/ui/auth-card.tsx` (AuthShell + AuthForm + LogoutForm)
- Modified: `app/actions/auth-login-controller.tsx` — new page rendering
- Modified: `app/actions/auth-register-controller.tsx` — new page rendering
- No changes to routes, middleware, auth logic, or rate limiting
