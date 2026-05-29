## 1. Register Rate Limiting

- [x] 1.1 Import `createRateLimiter` from `app/utils/rate-limiter.ts` in `app/actions/auth-register-controller.tsx`
- [x] 1.2 Create a module-level rate limiter instance (5 attempts / 15s window, per-user mode for email keying)
- [x] 1.3 Add rate limit check at the top of the `action` handler — return 429 with error message before account creation
- [x] 1.4 Reset rate limit counter on successful registration (after account is created)
- [x] 1.5 Verify tests in `app/actions/auth-register-controller.test.ts` cover rate limiting scenarios (within limit, exceeded, window expiry, success resets)

## 2. Breadcrumb Route Labels

- [x] 2.1 Add missing entries to `ROUTE_LABELS` in `app/ui/route-labels.ts`:
  - `/appointment` → "Terminbuchung"
  - `/appointment/events` → "Termine"
  - `/appointment/types` → "Termintypen"
  - `/admin/nutzer` → "Nutzer"
  - `/admin/offerings` → "Leistungen"
  - `/admin/offerings/config` → "Konfiguration"
  - `/admin/offerings/week` → "Wochenansicht"
  - `/admin/appointments` → "Termine"
  - `/admin/appointments/events` → "Termin-Events"

- [x] 2.2 Navigate to each route after adding labels and verify breadcrumbs render correctly in both main layout and admin shell

## 3. Breadcrumb Pattern Guide

- [x] 3.1 Rewrite `.opencode/context/project-intelligence/newapp/guides/breadcrumb-pattern.md` to reflect the current `ROUTE_LABELS`-based implementation (remove hardcoded if-statement examples, document the centralized map pattern)
- [x] 3.2 Cross-reference the guide from `app/ui/breadcrumbs.tsx` and `app/ui/route-labels.ts` to ensure the documentation explains the complete flow: `ROUTE_LABELS` → `getBreadcrumbs()` → `Breadcrumbs` component
