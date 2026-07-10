## Context

The app currently uses 7 separate route export objects defined in `app/routes.ts`:

| Export              | Contains                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `routes`            | Main routes: home, assets, ui, client, nutzer                            |
| `listsRoutes`       | Flat route leaves: lists, listsSave, listsUpdate, listsShow, listsData   |
| `authRoutes`        | Flat route leaves: authLogin, authRegister, authLogout                   |
| `appointmentRoutes` | Nested: appointment (index, create, update, destroy, events, types)      |
| `adminRoutes`       | Deeply nested: admin (chatlog, messages, lists, users, fragments)        |
| `verwaltungRoutes`  | Nested: verwaltung (offerings, appointments, resources, offeringConfigs) |
| `aiRoutes`          | Nested: ai (chat, agent, workflow, fragments)                            |

Each controller imports the specific export it needs. The auth logout handler bypasses the route system entirely via `router.post('/logout', ...)`. Multiple UI components and controllers use hardcoded `/login`, `/register`, `/logout` strings instead of typed `href()` calls.

The timeboxer demo (`~/remix/demos/timeboxer`) demonstrates the target pattern: a single `routes` export with auth properly namespaced under `/auth/` and all URL generation using typed `href()` calls.

## Goals / Non-Goals

**Goals:**

- Single `routes` export from `app/routes.ts` covering all application URLs
- Auth routes namespaced under `/auth/login`, `/auth/register`, `/auth/logout`
- Lists routes nested under `route('lists', {...})` preserving existing URLs
- All URL references use typed `routes.*.href()` — zero hardcoded URL strings
- Logout handler mapped via `router.map()` instead of raw `router.post()`
- Every controller imports from the same `routes` object

**Non-Goals:**

- Changing any non-auth URL paths
- Restructuring controller logic or middleware
- Extracting a domain/data layer
- Adding or removing any routes
- Changing HTTP methods or response contracts
- Altering test assertions beyond URL string updates

## Decisions

### Decision 1: Nest auth routes under `/auth/` prefix rather than keeping flat

**Chosen**: `auth: route('auth', { login: form('login'), ... })` producing `/auth/login`, `/auth/register`, `/auth/logout`

**Rationale**: A flat route like `authLogin: form('login')` is a single leaf, not a route map. `createController` and `router.map` require route maps to scope which routes a controller owns. Keeping auth flat would force the root controller to know about auth routes, or force continued raw `router.post()` registration. Nesting under `/auth/` makes auth routes a mappable subtree and follows the timeboxer convention.

**Alternative considered**: Keep flat auth routes at root level. Rejected because `createController(routes.authLogin, ...)` on a form route may work for the typed contract but `router.map(routes.authLogin, loginController)` would fail — `routes.authLogin` is a leaf, not a map. This forces continuing the raw bypass pattern.

### Decision 2: Nest lists routes under `/lists/` prefix preserving URLs

**Chosen**: `lists: route('lists', { index: get('/'), save: post('/save'), ... })`

**Rationale**: Same structural need as auth — flat routes can't be `.map()`'d as a group. The difference is that `/lists` is already in the path strings (`get('/lists')`, `post('/lists/save')`), so nesting under `route('lists', ...)` preserves all URLs. The only change is from `get('/lists')` → `get('/')` within the nested route, which the prefix resolves to `/lists`.

### Decision 3: Single import path for all controllers

**Chosen**: Every controller imports `{ routes }` from the same `app/routes.ts` path.

**Rationale**: Currently controllers import from 7 different export names. After merging, all import `routes` from the same file. The mental model shifts from "which export owns this URL?" to "where in the tree is this route?" — answered by the dot-path: `routes.auth.login`, `routes.admin.users`, etc.

### Decision 4: Resolve logout bypass via proper controller

**Chosen**: Replace `router.post('/logout', authLogout)` with `router.map(routes.auth.logout, logoutController)` where `logoutController` is `createAction(routes.auth.logout, ...)`.

**Rationale**: The current `createAction` approach works but `router.post()` bypasses the route contract. Using `router.map()` keeps all URL registration within the typed system. The `logoutController` itself stays as `createAction()` since `post('logout')` only has one handler.

## Risks / Trade-offs

**[Risk] Auth URL change breaks external links, bookmarks, or hardcoded references in emails/templates** → Mitigation: Audit codebase for all `/login`, `/register`, `/logout` strings before migration. Add server-side redirects from old URLs to new during a transition period if needed. This app is in active development with no production traffic — the risk is low.

**[Risk] `formAction` string in login controller bypasses `href()` for returnTo query params** → Mitigation: Pass `returnTo` as a separate search param setter on the form action URL, using `routes.auth.login.action.href()` and appending `?returnTo=...` via `URLSearchParams`.

**[Risk] Test assertions reference `/login` as a string** → Mitigation: Tests should use `routes.auth.login.index.href()` or `routes.auth.login.action.href()` instead of hardcoded paths. CSRF tests that fetch `/login` for token extraction can fetch any page — migrate to use `routes.auth.login.index.href()`.

**[Risk] Merge conflict with ongoing feature work** → Mitigation: This change touches routes.ts, router.ts, and imports. Other features rarely modify these files. Do the merge in a single atomic commit with `git mv` where applicable.

## Open Questions

None. The design is fully resolved from exploration of both codebases.
