## Why

Two medium-severity issues degrade the app's robustness and developer experience:

1. **Register endpoint has no rate limiting** — The login controller limits to 5 attempts per 15s per email, but the register endpoint has no protection. This makes it possible to automate account creation, spam the user DB, or brute-force email enumeration. A rate limiter utility already exists (`app/utils/rate-limiter.ts`) but is unused.

2. **Breadcrumbs drift from actual routes** — The breadcrumb trail is built from a centralized `ROUTE_LABELS` map (`app/ui/route-labels.ts`), but several active routes are missing entries (admin sub-routes: nutzer, offerings, appointments; client create/edit; appointment types). This results in breadcrumbs falling back to just "Home" on those pages. The pattern guide at `app/ui/breadcrumbs.tsx` is also out of sync with the current `ROUTE_LABELS`-based implementation.

## What Changes

- Add rate limiting to the POST `/register` endpoint, mirroring the login controller's per-email pattern (in-memory Map, 5 attempts / 15s window)
- Add missing route labels to `ROUTE_LABELS` in `app/ui/route-labels.ts` so breadcrumbs render correctly on:
  - `/admin/nutzer`, `/admin/nutzer/*`
  - `/admin/offerings`, `/admin/offerings/*`
  - `/admin/appointments`, `/admin/appointments/*`
  - `/appointment`, `/appointment/*`
  - `/client/create`, `/client/edit/*`
  - `/workflow`, `/workflow/*`
- Update the breadcrumb pattern guide at `.opencode/context/project-intelligence/newapp/guides/breadcrumb-pattern.md` to reflect the current `ROUTE_LABELS`-based implementation
- The rate limiter already exists at `app/utils/rate-limiter.ts` — no new utility code needed

## Capabilities

### New Capabilities

- `register-rate-limiting`: Rate limiting for the registration endpoint to prevent automated abuse
- `breadcrumb-auto-sync`: Complete and accurate breadcrumb coverage for all active routes, enforced through the centralized `ROUTE_LABELS` map

### Modified Capabilities

<!-- No existing specs are being modified; both capabilities are new additions -->

## Impact

- `app/actions/auth-register-controller.tsx` — Add rate limiter instance and check before account creation
- `app/ui/route-labels.ts` — Add ~15 missing route label entries
- `.opencode/context/project-intelligence/newapp/guides/breadcrumb-pattern.md` — Rewrite to match current implementation
- No database schema changes
- No new dependencies
- No breaking changes
