## Context

The app has two parallel route systems:

1. **Typed route objects** defined in `app/routes.ts` via `route()`, `get()`, `post()`, `form()`, `resources()`. These carry URL patterns in the type system and produce hrefs via `.href(params?)`.

2. **Hardcoded URL strings** used in ~15 UI page components (`app/ui/`), ~4 client assets (`app/assets/`), and the hand-maintained `ROUTE_LABELS` map (`app/ui/route-labels.ts`). `router.ts` has 3 routes using `.href()` → string registration instead of `router.map()`.

The `admin-urls.ts` helpers (`buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl`, `buildCancelUrl`) all accept a `base: string` parameter, and callers pass hardcoded path strings. These helpers themselves are sound — the problem is what callers feed them.

```
routes.ts (typed) ──→ router.ts (mostly router.map()) ──→ controllers (typed)
                                                              ↓
                    route-labels.ts (string map) ──────→ breadcrumbs.tsx
                                                              ↑
                    ui/*-page.tsx (hardcoded strings) ──── form action, href, fetch
                                                              ↑
                    assets/*.tsx (hardcoded strings) ────── fetch, location.href
```

## Goals / Non-Goals

**Goals:**

- Every `form action`, `<a href>`, `<Frame src>`, redirect URL, and `fetch()` URL in server-rendered UI components uses `routes.X.href()` or passes it through
- The `ROUTE_LABELS` string map is replaced with route-derived label registration
- The 3 `.href()` string registrations in `router.ts` become `router.map()` calls
- Achieve zero hardcoded URL strings in `app/ui/` and `app/routes.ts`/`app/router.ts`

**Non-Goals:**

- Renaming the route tree structure or changing URL paths
- Changing controller handler signatures
- Making client-side-only assets (`app/assets/`) import `routes.ts` directly — they receive URLs as props from server-rendered parents
- Fixing test files that use hardcoded URL strings for assertions (those are test implementation details)

## Decisions

### 1. Route labels via typed registration, not string map

Instead of a flat `Record<string, string>` that must be manually kept in sync, add a `routeLabels` registry that lives alongside route definitions:

```typescript
// app/routes.ts — add label alongside each route
export const routeLabels = {
  [routes.admin.href()]: 'Admin Dashboard',
  [routes.admin.users.href()]: 'Users',
  [routes.verwaltung.href()]: 'Verwaltung',
  [routes.verwaltung.offerings.href()]: 'Angebote',
  // ...
} as const satisfies Record<string, string>
```

The breadcrumb `getBreadcrumbs()` function remains pathname-based (it receives the current URL at runtime), so it still needs a path→label lookup. But now the lookup is derived from the actual route objects, not a disconnected string map.

**Alternative considered:** Make breadcrumbs accept route object references directly. Rejected because breadcrumbs receive a raw pathname string from `context.request.url` and the `Frame` location API — they can't know which route object generated the path at runtime.

### 2. Convert UI page components to use routes

Each page currently does something like:

```typescript
action = '/verwaltung/offering-configs'
```

becomes:

```typescript
action={routes.verwaltung.offeringConfigs.index.href()}
```

The `admin-urls.ts` helpers already parameterize the `base` — callers pass the typed href instead:

```typescript
// Before
buildCancelUrl('/verwaltung/offering-configs', ...)
// After
buildCancelUrl(routes.verwaltung.offeringConfigs.index.href(), ...)
```

This is the bulk of the work — ~15 components.

### 3. Client assets receive URLs as props

Components in `app/assets/` run on the client and cannot import `routes.ts` directly. The server-rendered pages that embed these assets will pass the typed URLs as props:

```typescript
// Before: appointment-page.tsx
<Frame src="/appointment/types" />
// After
<Frame src={routes.appointment.types.index.href()} />

// Before: admin-appointments-context-menu.tsx (hardcoded redirect)
// After: server renders a data-url attribute on the context menu trigger
```

### 4. Convert router.ts registrations

Three routes use `router.get(routes.X.href(), handler)` which takes a string pattern. Switch to `router.map(routes.X, createController(...))`:

- `registerSent`: Create a small controller for the single GET route
- `verify`: Already has a handler function — wrap in `createAction` or `get()` equivalent
- `authLogout`: Already uses `createAction(routes.auth.logout, ...)` — the `router.post(routes.auth.logout.href(), authLogout)` call can use `router.map(routes.auth.logout, authLogout)` instead

### 5. Route labels as optional export from a registration module

Rather than having routes.ts export labels directly, create a thin `app/route-labels.ts` module that imports `routes` and builds the label map. This keeps label concerns separate from route definition concerns.

## Risks / Trade-offs

- **Breadth of changes** (~20 files edited) → Mitigation: Each change is mechanical (string → href call), easy to review
- **Client assets can't import routes.ts** → Mitigation: Server passes URLs as props; no architectural change needed
- **Frame src patterns** (`<Frame src="/appointment/types">`) → Must use the typed `routes.appointment.types.index.href()`. Low risk since route structure isn't changing.
- **`appointment-grid.tsx` `fetch()` calls** run client-side and construct URLs dynamically with IDs → These `fetch()` calls already template IDs into the path. The base path can be passed as a prop or imported from a shared constant. Since `app/routes.ts` is server-only, the grid component can receive `{ appointmentBaseHref: string }` as a prop from the page component.
