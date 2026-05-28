<!-- Context: project-intelligence/newapp | Priority: high | Version: 2.8 | Updated: 2026-05-28 -->

# Newapp Context Index

## Overview
Scaffolded Remix 3 app (`remix new`) with:
- 11-layer middleware stack (logger → compression → formData → methodOverride → session → asyncContext → database → auth → loadAssetEntry → render → json)
- Direct context property access (`context.render`, `context.json`, `context.db`, `context.auth`, etc.)
- `RouterTypes` declaration for fully-typed `getContext()`
- Session-based auth with `createCredentialsAuthProvider` + admin role checks
- PostgreSQL via `remix/data-table-postgres` with 7 tables (appointments uses `int4range` with `btree_gist` exclusion constraint for overlap prevention)
- `createController` with typed actions and per-controller middleware
- Custom `createTheme()` preserving starter identity
- Router factory pattern (`createNewappRouter`) for testability
- `RestfulForm` component + `methodOverride()` middleware for RESTful HTML forms
- `data-schema` validation with `email()`/`minLength()`/`defaulted()` pipes
- Frame-based inline sidebar CRUD at `/client` with RESTful routes (PUT/DELETE/POST)
- Admin nutzer (user) table with right-click context menu using `menu.Context` + event delegation + JSON endpoints (reset password, lock/unlock, activate/deactivate)
- Admin offerings CRUD grid at `/admin/offerings` with raw SQL, sortable table, pagination, filter, inline sidebar edit/create, and exclusion constraint 409 conflict detection
- Admin appointments CRUD grid at `/admin/appointments` with raw SQL (JOIN users + resources), sortable table, ILIKE search across title/user/resource, inline sidebar edit/create, exclusion constraint overlap detection, and FK constraint 409 on delete
- Dependency: `remix@3.0.0-beta.2` (updated from beta.1 — see `pnpm-lock.yaml` for full resolution changes)

## Structure

```
newapp/
├── concepts/          # Architecture, middleware, context access, auth, database, theme, form ergonomics, appointment hydration, rate limiting, performance patterns
├── guides/            # Controller patterns, mixins, nav, client entry, layout, frame CRUD, inline CRUD, admin offerings/appointments CRUD
├── examples/          # Controller example, custom middleware template
├── errors/            # Client lab gotchas, raw SQL afterRead bypass, pre-built SSR bridge, resize offset bug
└── lookup/            # Pagination, sort, data-schema API, shared utilities, known issues
```

## Quick Reference

| Item      | Details                     |
|-----------|-----------------------------|
| Port      | 44100                       |
| Server    | `server.ts`                 |
| Theme     | `app/theme.tsx`             |
| Routes    | `app/routes.ts`             |
| Router    | `app/router.ts` (factory: `createNewappRouter()`) |
| Main controller | `app/actions/controller.tsx`|
| Lists controller | `app/actions/lists-controller.tsx` (auth-protected)|
| Client controller | `app/actions/client/controller.tsx` (auth-protected CRUD)|
| Nutzer controller | `app/actions/admin-nutzer-controller.tsx` (admin, JSON endpoints)|
| Offerings controller | `app/actions/admin-offerings-controller.tsx` (admin, raw SQL, sortable grid)|
| Appointments controller | `app/actions/admin-appointments-controller.tsx` (admin, raw SQL, users+resources JOIN, sortable grid)|
| Nutzer context menu | `app/assets/nutzer-table-interactive.tsx` (clientEntry) |
| Layout    | `app/ui/layout.tsx`         |
| Document  | `app/ui/document.tsx`       |
| RestfulForm | `app/ui/restful-form.tsx` |
| Router factory | `app/router.ts` → `createNewappRouter()` |

## Key Patterns

### Infrastructure & Middleware
- **[Middleware Chain](./concepts/middleware-chain.md)** — 11-layer stack: logger, compression, formData, methodOverride, session, asyncContext, database, auth, loadAssetEntry, render, json
- **[Dual Renderer Pattern](./concepts/dual-renderer.md)** — `context.render()` for HTML UI, `context.json()` for JSON API responses
- **[App Architecture](./concepts/architecture.md)** — Route-to-controller mapping, middleware stack, file ownership (22 key decisions)
- **[Router Factory Pattern](./concepts/architecture.md)** — `createNewappRouter()` exported from `app/router.ts`, used in `server.ts` with optional cookie/storage overrides

### Form Handling & Validation
- **[Form Ergonomics](./concepts/form-ergonomics.md)** — Three-layer form system: `RestfulForm` UI component, `methodOverride()` middleware, `data-schema` validation pipes
- **[data-schema API Reference](./lookup/data-schema-api.md)** — Quick reference for `s.string()`, `email()`, `minLength()`, `defaulted()`, `f.object()`, `f.field()`
- **[Controller Pattern](./guides/controller-pattern.md)** — `createController` with typed actions, per-controller middleware, destructuring (now includes RestfulForm + schema patterns)

### Auth & Sessions
- **[Auth Architecture](./concepts/auth-architecture.md)** — Password credentials, session scheme, requireAuth/requireAdmin, completeAuth(), session hardening, login rate limiting, controller-level auth protection
- **[Auth Redirect Flow](./guides/auth-redirect-flow.md)** — `requireAuth()` captures current path, `returnTo` param in login, safe redirect validation
- **[ReturnTo Security](./guides/return-to-security.md)** — `getSafeReturnTo()` hardened with URL parsing to block backslash-based open redirects

### Database & Data
- **[Database Architecture](./concepts/database-architecture.md)** — PostgreSQL + 8 tables + CRUD via `remix/data-table-postgres`
- **[PostgreSQL Range Types](./concepts/postgres-range-types.md)** — `int4range` with `beforeWrite`/`afterRead` lifecycle hooks
- **[Exclusion Constraints](./concepts/exclusion-constraints.md)** — Overlap prevention with `btree_gist` + `EXCLUDE USING GIST`
- **[Computed Columns](./concepts/computed-columns.md)** — `GENERATED ALWAYS AS ... STORED` as read-only fields
- **[Pagination & Sort Utilities](./lookup/pagination-sort-utils.md)** — `paginate()` and `parseSort()` quick reference
- **[AppointOffering Concept](./concepts/appointoffering.md)** — Resource availability, `during` (int4range) handling, server-side 403 validation flow
- **[AppointOffering CRUD Guide](./guides/appointoffering-crud.md)** — `listOfferingsByWeek`, `isSlotBookable`, `parseDuring`, controller validation integration

### CRUD & UI Patterns
- **[Appointment Schema & Queries](./guides/appointment-schema-queries.md)** — Table schema, week-range queries, ownership isolation
- **[Appointment CRUD Controller](./guides/appointment-crud-controller.md)** — Data layer functions, validation schemas, JSON API actions
- **[Appointment Calendar Architecture](./concepts/appointment-calendar.md)** — Weekly calendar at `/appointment` with own controller, data layer, client-hydrated grid, server-embedded JSON, JSON fetch API mutations, 15-min snap interval (`SLOT_HEIGHT=160`, `SUB_SLOTS=4`, `MINIMUM_DURATION=15`)
- **[Appointment Grid SSR Hydration](./concepts/appointment-hydration.md)** — How `clientEntry` components handle SSR vs client rendering, `document` global issue, placeholder pattern to avoid hydration mismatch
- **[Appointment Grid Performance Patterns](./concepts/performance-patterns.md)** — Set-based O(1) slot bookability lookup, Map-based O(n) appointment grouping
- **[In-Memory Rate Limiting Pattern](./concepts/rate-limiting.md)** — Per-user `Map<userId, timestamp>` rate limiters for appointment mutations, production-only activation via env var
- **[Dynamic Grid Filtering](../../development/remix3/ui/guides/dynamic-grid-filtering.md)** — Offering-driven grid: dynamic column count, per-slot bookability, red diagonal stripe styling, `currentVisibleDays` pattern
- **[AppointType Inline CRUD (Frame)](./guides/appointtype-inline-crud.md)** — Frame-loaded types panel with inline rename, context menu, JSON API for create/update/delete — no server-rendered forms
- **[AppointType Drag-to-Insert](./guides/appointtype-drag-insert.md)** — Drag a type from panel → drop on grid → POST with `typeId` → INSERT...SELECT on server — shared module-level drag state between two `clientEntry` closures
- **[AppointType INSERT…SELECT](./guides/appointtype-insert-select.md)** — Raw SQL `INSERT INTO appointments SELECT ... FROM appointtypes` — bypasses `beforeWrite()`, requires manual timestamp sync, security via `user_id` filter
- **[Inline Rename Pattern](./guides/inline-rename-pattern.md)** — Textarea-based inline title editing with Shift+Enter commit, Escape cancel, block height adjustment
- **[Manual Double-Click Detection](./concepts/manual-doubleclick-detection.md)** — Why pointerdown+preventDefault kills native dblclick and how `lastClick` timing detection works around it
- **[Hover Tooltip Pattern (removed)](./concepts/hover-tooltip-pattern.md)** — ⚠️ Tooltip removed; hover-expanded titles now render multiline correctly
- **[Drag-to-Trashcan Delete Guide](./guides/drag-to-trashcan.md)** — Delete appointments by dragging blocks onto a trashcan drop zone in the grid header (replaces × button)
- **[Client Lab Architecture](./concepts/client-lab-architecture.md)** — Auth-protected `/client` route with own controller + requireAuth, RESTful routes (PUT/DELETE/POST), inline sidebar CRUD
- **[Frame CRUD Pattern](./guides/frame-crud-pattern.md)** — Frame-based grid with Frame navigation, RestfulForm PUT/DELETE, inline sidebar edit/create, pagination/sort/filter
- **[Inline CRUD Pattern](./guides/inline-crud-pattern.md)** — Edit/create in sticky sidebar panel via `?editing=` / `?creating=true`, RestfulForm methods
- **[Flat Controller Pattern](./guides/flat-controller-pattern.md)** — Creating nested routes with their own `app/actions/<route>/controller.tsx` (client CRUD, lists, admin)
- **[Handle Pattern Migration](./guides/handle-pattern-migration.md)** — Migrating from factory pattern to canonical `Handle<Props>` pattern (18 components)
- **[ReturnTo Security](./guides/return-to-security.md)** — `getSafeReturnTo()` open-redirect protection via URL parsing

### UI & Layout
- **[Context Access Patterns](./concepts/context-access-patterns.md)** — Direct properties (controllers) vs getContext() (layouts/utils) vs context.get() (middleware)
- **[Custom Theme Setup](./concepts/theme-setup.md)** — `createTheme()` with starter identity preservation, `BASE_THEME_VALUES` shared constant
- **[Namespace-Style Mixins](./guides/namespace-mixins.md)** — Organization of CSS-only mixins per component module
- **[Page Primitives](./guides/page-primitives.md)** — Shared `PageSection`, `ShowcaseLinkCard`, and CSS constants
- **[Nav Registry](./guides/nav-registry.md)** — Data-driven `NAV_SECTIONS` with section headings, `adminOnly` filtering
- **[Showcase Registry](./guides/showcase-registry.md)** — Registry-driven `/ui/:component` routing via typed `SHOWCASE_PAGES`
- **[Breadcrumb Pattern](./guides/breadcrumb-pattern.md)** — `getBreadcrumbs()` path-to-trail mapping
- **[Admin Frame-Nav Pattern](./guides/admin-frame-nav-pattern.md)** — Admin/AI sidebar with `NAV_GROUPS`, `renderAdminPage()`, `rmx-target` frame navigation
- **[Component Adoption](./guides/component-adoption.md)** — Adopting `remix/ui/*` components
- **[clientEntry Hash Fragment Pattern](./guides/client-entry-pattern.md)** — `import.meta.url + '#ExportName'`, zero-arg RenderFn, `Handle<PropsType>` generic
- **[Sticky Footer Layout](./guides/sticky-footer-layout.md)** — Flexbox body + scrollable content with theme-driven styles

### Admin & Database
- **[Admin Offerings CRUD Guide](./guides/admin-offerings-crud.md)** — Raw SQL grid with pagination, sort, filter, exclusion constraint 409 handling
- **[Admin Offerings UI Guide](./guides/admin-offerings-ui.md)** — Grid page, sidebar form panels, grid state preservation
- **[Admin Appointments CRUD Guide](./guides/admin-appointments-crud.md)** — Same pattern as offerings: raw SQL grid, ILIKE search, exclusion constraint overlap detection
- **[Admin Appointments UI Guide](./guides/admin-appointments-ui.md)** — Grid page, sidebar create/edit forms, grid state preservation
- **[Admin Filter Pattern](./guides/admin-filter-pattern.md)** — GIN-indexed ILIKE search on text + JSONB arrays, filter preservation, BIGINT conversion
- **[Admin Context Menu Pattern](./guides/admin-context-menu-pattern.md)** — Right-click context menus: evolution from fragile (display:none+setTimeout) to canonical (opacity:0 hidden trigger) across 3 implementations
- **[JSON Endpoint Admin Actions](./concepts/json-endpoint-admin-actions.md)** — Lightweight POST+JSON endpoints for admin row actions (toggles, password reset) without frames
- **[Database Optimization](./concepts/database-optimization.md)** — Indexing strategy, `pg_trgm` GIN for ILIKE, covering indexes

### Errors & Lookup
- **[Client Lab Gotchas](./errors/client-lab-gotchas.md)** — Fragment caching, filter state preservation, date handling, data-schema pitfalls, RestfulForm + methodOverride ordering
- **[Raw SQL afterRead Bypass](./errors/raw-sql-bypasses-afterread.md)** — **🔴 High**: `pool.query()` returns BIGINT as strings; `afterRead` hook not applied
- **[data-schema API Reference](./lookup/data-schema-api.md)** — Email, minLength, defaulted, form-data bindings
- **[clientEntry Export Mismatch](./errors/client-entry-export-mismatch.md)** — Gotcha when handler function name differs from export name
- **[× Delete Button Pointerdown Conflict](./errors/delete-button-pointerdown-conflict.md)** — Why per-block delete buttons can't coexist with `dblclick` editing (root cause analysis); also covers the manual double-click detection workaround
- **[Pre-built Component SSR Bridge](./errors/prebuilt-component-ssr-bridge.md)** — Pre-built `remix/ui/*` components using client-side mixins don't work in SSR without a `clientEntry` bridge
- **[Resize Offset Bug](./errors/resize-offset-bug.md)** — Resize jump when offering start ≠ midnight: `offsetY` missing `currentOfferingStartMin` subtraction
- **[Shared Utilities](./lookup/shared-utilities.md)** — Quick reference for `readAppointmentData()` and `formatDateRange()` used by grid and sidebar
- **[Known Issues](./lookup/known-issues.md)** — Hardcoded session secret, afterRead bypass, FK constraint in tests, draft/rename input focus timing

### Examples
- **[Controller Example](./examples/controller-example.md)** — Minimal controller with context property access
- **[Custom Middleware Example](./examples/middleware-custom.md)** — Template for route-level middleware

## Related Context (Alpha4 Root)

### General Remix 3 Patterns

These files document the general patterns that newapp applies in its specific context:

| Context | Path | Applies To |
|---------|------|------------|
| Remix 3 UI patterns | `development/remix3/ui/navigation.md` | All UI |
| Namespace mixins (general) | `development/remix3/ui/guides/namespace-mixins.md` | [newapp mixins](./guides/namespace-mixins.md) |
| Dual theme pattern (general) | `development/remix3/ui/guides/dual-theme-pattern.md` | [newapp theme](./concepts/theme-setup.md) |
| Typed nav registry (general) | `development/remix3/ui/guides/layout-best-practices.md` | [newapp nav registry](./guides/nav-registry.md) |
| CSS mixins guide | `development/remix3/ui/guides/css-mixins.md` | `css()` syntax + tokens |
| Theme contract | `development/remix3/ui/concepts/theme-contract.md` | `createTheme()` API |
| SSR theme switching | `development/remix3/ui/concepts/theme-switching.md` | Cookie + flash-prevention |
| Design system | `development/remix3/ui/concepts/design-system.md` | Token conventions |
| Frame vs clientEntry | `development/remix3/ui/concepts/frame-vs-client-entry.md` | [clientEntry pattern](./guides/client-entry-pattern.md) |
| clientEntry side effects | `development/remix3/ui/guides/client-entry-side-effects.md` | Side-effect-only patterns |
| clientEntry issues (errors) | `development/remix3/errors/client-entry-issues.md` | [clientEntry export mismatch](./errors/client-entry-export-mismatch.md) |
| Typed SSE channel factory | `development/remix3/sse/concepts/channel-factory.md` | [admin SSE channel](../newapp/app/lib/messages-sse.ts) |
| SSE connection indicator | `development/remix3/sse/guides/connection-indicator.md` | [ConnectionIndicator](../newapp/app/assets/connection-indicator.tsx) |

## SSE Infrastructure

Both admin messages and appointment pages use `createChannel` for real-time invalidation:

### Messages SSE
| File | Purpose |
|------|---------|
| `app/lib/sse.ts` | `createChannel` factory (generic, see remix3/sse docs) |
| `app/lib/sse.test.ts` | 10 unit tests for the factory |
| `app/lib/messages-sse.ts` | `adminChannel = createChannel<{ invalidate: void }>()` |
| `app/assets/connection-indicator.tsx` | SSE connection status indicator (clientEntry) |
| `app/actions/admin-messages-controller.tsx` | `adminChannel.subscribe()` in subscribe action |
| `app/ui/admin-messages-page.tsx` | Shows `ConnectionIndicator` in header |

### Appointments SSE (shared channel, public + admin)
| File | Purpose |
|------|---------|
| `app/lib/appointments-sse.ts` | `appointmentChannel = createChannel<{ invalidate: void }>()` — shared channel |
| `app/actions/appointment-controller.tsx` | `appointmentChannel.subscribe()` at `/appointment/events` + broadcast on mutations |
| `app/actions/admin-appointments-controller.tsx` | `appointmentChannel.subscribe()` at `/admin/appointments/events` + broadcast on mutations |
| `app/ui/appointment-page.tsx` | `ConnectionIndicator` in sticky bar, `reloadMode: 'window'` |
| `app/ui/admin-appointments-page.tsx` | `ConnectionIndicator` in header bar, `reloadMode: 'frame'`, `skipReloadParams: ['editing', 'creating']` |

## Commands

```sh
# Run dev server (port 44100)
npm run start

# Type check
npm run typecheck
```
