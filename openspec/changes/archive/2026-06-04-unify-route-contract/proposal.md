## Why

The app currently defines routes across 7 separate export objects (`routes`, `listsRoutes`, `authRoutes`, `aiRoutes`, `adminRoutes`, `appointmentRoutes`, `verwaltungRoutes`), making it hard to discover which export owns a given URL. Auth URLs (`/login`, `/register`, `/logout`) sit at the root level with no namespace prefix, and one logout handler bypasses the route system entirely via `router.post('/logout', ...)`. Unifying into a single route tree makes the system's URL space self-documenting and eliminates ad-hoc URL strings in favor of typed `href()` generation.

## What Changes

- Merge 7 route exports into a single `routes` object in `app/routes.ts`
- Nest `lists` routes under `route('lists', {...})` preserving existing URLs
- Nest `auth` routes under `route('auth', {...})` — **BREAKING**: URLs change from `/login` → `/auth/login`, `/register` → `/auth/register`, `/logout` → `/auth/logout`
- Replace `router.post('/logout', authLogout)` with typed `router.map(routes.auth.logout, ...)` — **BREAKING**
- Replace ~15 hardcoded URL strings (`/login`, `/register`, `/logout`) in controllers, UI components, and tests with `routes.*.href()` calls
- Update all 27 controller imports from individual route exports to the single `routes` import

## Capabilities

### New Capabilities

- `unified-route-contract`: A single route tree defining all application URLs, with auth routes properly namespaced under `/auth/`, all URL generation using typed `href()` calls, and no raw URL strings in the router or UI code.

### Modified Capabilities

None. This change restructures how routes are declared and referenced but does not alter any feature-level requirements or behaviors.

## Impact

- **app/routes.ts**: 7 exports merged to 1, auth and lists routes gain route prefixes
- **app/router.ts**: Single routes import, auth URLs change, raw `router.post()` removed
- **27 controller files**: Import path changes from specific route exports to `routes`
- **~6 UI files**: Hardcoded URLs replaced with typed `href()` references
- **~5 test files**: Hardcoded URL strings updated to `routes.*.href()`
- **Middleware/app context**: No changes required
- **Data layer**: No changes required
