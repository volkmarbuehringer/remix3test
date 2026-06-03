## Context

The current `/admin` route tree under `adminRoutes.admin` in `app/routes.ts` hosts all administrative functionality in a single sidebar-based layout. Admin pages use a `createSidebarLayout` factory (`app/ui/admin-layout.tsx`) that renders a sticky left sidebar with nav groups and a content area on the right. All admin controllers include `[requireAuth(), requireAdmin()]` middleware.

Four routes manage operational data:
- `/admin/offerings` — offering CRUD + config save + week generation
- `/admin/appointments` — appointment CRUD + SSE events
- `/admin/resources` — resource CRUD (resources helper)
- `/admin/offering-configs` — offering configs CRUD (resources helper)

A future change will upgrade form handling in these routes to remove URL-encoded form state (the `fv_*`/`fe_*` pattern), but will preserve field-level errors and error message placement. This route tree move is prerequisite groundwork.

## Goals / Non-Goals

**Goals:**
- Create a new `/verwaltung` route tree with a simple card-based dashboard (no sidebar)
- Move offerings, appointments, resources, and offering-configs routes under `/verwaltung`
- Each of the four moved routes retains identical controller logic, form behavior, and middleware
- Remove the four routes from the `/admin` route tree
- Remove the four nav items from the admin sidebar nav groups

**Non-Goals:**
- Changing form validation patterns in the four controllers (that is a separate change)
- Changing the sidebar layout factory or frame architecture for `/admin`
- Adding new features to the dashboard beyond navigation cards
- Modifying how the moved controllers handle auth (still use `requireAuth() + requireAdmin()`)

## Decisions

**1. New route tree as separate export from `routes.ts`**

The verwaltung routes are defined as a new named export `verwaltungRoutes` in `app/routes.ts`, following the same pattern as `adminRoutes` and `aiRoutes`. Each moved route maps 1:1 from its admin counterpart (identical methods, paths, params). The `offerings.configSave` and `offerings.weekGenerate` sub-routes are preserved.

Rationale: Keeps all route definitions co-located. Allows `router.ts` to map the trees to separate controllers without route tree restructuring.

**2. Simple page layout — no sidebar, no frames**

The verwaltung dashboard uses a plain `Layout` component (same as the main `app/ui/layout.tsx`) with card-based navigation. No `createSidebarLayout`, no frames, no `X-Remix-Target` header matching.

Rationale: The sidebar pattern is appropriate for the admin area with many nav items, but `/verwaltung` has only 4+1 pages. Card navigation is simpler and avoids the complexity of frame-based rendering. The user explicitly requested "no sidebar."

**3. Four controllers updated to reference verwaltung routes**

Each of the four controllers (`admin-offerings-controller.tsx`, `admin-appointments-controller.tsx`, `admin-resources-controller.tsx`, `admin-offering-configs-controller.tsx`) changes its import from `adminRoutes` to `verwaltungRoutes` and uses the new route tree shape. The controller function bodies and middleware remain identical.

Rationale: Minimal diff per controller. The route type parameter changes but the action logic is unchanged. This is a pure mechanical refactor.

**4. Dashboard controller with index action only**

A new `app/actions/verwaltung-controller.tsx` handles the `/verwaltung` index with `[requireAuth(), requireAdmin()]` middleware, rendering the dashboard page.

Rationale: Follows the same pattern as `admin-controller.tsx` for `/admin` index. Separates concerns cleanly.

**5. Admin sidebar nav items removed for moved routes**

The `admin-layout.tsx` `NAV_GROUPS` array drops the four nav items (`offerings`, `appointments`, `resources`, `offeringConfigs`) and their corresponding `AdminNavItem` union members.

Rationale: Avoids dead links. Keeps admin sidebar focused on system administration.

**6. Grid state URLs reference verwaltung prefix**

Offerings and appointments pages currently build URLs like `/admin/offerings?offset=...` or `/admin/appointments?<params>`. These update to `/verwaltung/offerings...` and `/verwaltung/appointments...`.

Rationale: All reference URLs must match the new route prefix for correct redirects and navigation.

## Risks / Trade-offs

- **Risk: External bookmarks/links to old admin URLs break** — Any saved links to `/admin/offerings`, `/admin/appointments`, etc. will 404 after deployment.
  - Mitigation: A future redirect could be added from old admin URLs to new verwaltung URLs. This is a separate concern; the initial move does not include redirection.
- **Risk: Test files reference old admin route paths** — Controller tests that create requests to `/admin/offerings` or `/admin/appointments` will fail after the route prefix changes.
  - Mitigation: Test files are updated in the same change to use `/verwaltung` prefixes, ensuring the test suite stays green.
