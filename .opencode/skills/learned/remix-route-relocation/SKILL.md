---
name: remix-route-relocation
description: Use when moving a Remix 3 route between route trees (admin frame-sidebar ↔ top-level, frame ↔ full-page), upgrading form validation to parseSafe + context.render, or deleting a route.
---

# Remix 3 Route Relocation & Form Validation Upgrade

Use this skill when relocating a Remix 3 route between route trees (e.g. from admin sidebar to top-level) or upgrading form validation from URL-redirect to `parseSafe` + `context.render()`.

## Route Relocation Checklist

When moving a route from one tree to another (e.g. `adminRoutes.admin.foo` → `routes.foo`):

### 1. Route Definition (routes.ts)

- [ ] Move the route entry to the target tree
- [ ] Remove from the source tree
- [ ] Verify path nesting — `route('foo')` under top-level produces `/foo`
- [ ] Keep the old URL alive when anything may hold it (bookmarks, stale SSE tabs): leave a
      same-origin redirect in the source tree —
      `Location: '/admin' + context.url.pathname + context.url.search`.
      Always prepend a fixed prefix; never use the raw `pathname` as the whole Location.

### 2. Router Mapping (router.ts)

- [ ] Update `router.map(<newRouteRef>, <controller>)` to reference the new location
- [ ] Register **static** children (`create`, `events`) before the parent group's dynamic `:id`
      resolver, and add a test proving the static child hits its own handler — an SSE `events`
      route must return `text/event-stream`, not the `:id` resolver's redirect.

### 3. Navigation Updates

- [ ] Add to target nav: main navbar (`NAV_SECTIONS`), sidebar, or both
- [ ] Remove from old nav location
- [ ] Remove from old `AdminNavItem` type union if applicable
- [ ] Update `route-labels.ts` — it maps URL paths to breadcrumb labels

### 4. URL String Audit

Run: `grep -r "old/path" app/` — update every occurrence:

- [ ] Controller: redirect `Location` headers
- [ ] Page component: `ADMIN_BASE` constant, form `action` attributes, cancel links
- [ ] Form components: `action` attributes, cancel URLs
- [ ] ClientEntry/asset files: fetch URLs, `window.location.href` navigations
- [ ] Tests: route references, URL constants, assertions
- [ ] **Relative import depth:** `git mv` one directory deeper adds a `../` to every relative
      import (`app/actions/foo/create/` → `app/actions/admin/foo/create/` changes `../../../` to
      `../../../../`). Typecheck reports these as `TS2307`. For `public/` client entries see
      `remix3-browser-source-public-colocation`.

### 5. Frame Removal (if leaving frame layout)

When moving from admin frame sidebar to full-page `Layout`:

- [ ] Replace `renderAdminPage(context.render, 'key', ...)` with `context.render(<Layout title="Page Title"><PageComponent ... /></Layout>)`
- [ ] Import `Layout` from `app/ui/layout.tsx` instead of `renderAdminPage`
- [ ] Remove all `data-rmx-target={frames.*}` attributes from links
- [ ] Remove `frames` import from page components
- [ ] Change `<a data-rmx-target={...}>` to plain `<a href={...}>` (full page navigation)

## Form Validation

When upgrading form validation from URL-redirect to `parseSafe` + `context.render()`, see the full detailed pattern in:

> **`form-error-handling-remix3`** — covers `parseSafe` schemas, `issuesToFieldErrors`, error styling, checkbox preservation, DB constraint re-rendering, `coerce.number()` pitfalls, grid state preservation, wizard POST state, and testing.

The relocation-specific checklist below covers what to verify after the validation upgrade.

## Code Review Checklist

After route relocation + validation upgrade, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm test` — all tests pass
- [ ] `grep -r "old/path" app/` returns no stale references
- [ ] No `data-rmx-target` attributes remain in relocated page components
- [ ] Every text input has `inputErrorStyle` + `fieldErrorStyle`
- [ ] Required DB fields have corresponding `minLength(1)` in schema
- [ ] DB error catch blocks re-render with user-friendly message (no re-throw)
- [ ] `route-labels.ts` entry updated for the new path
- [ ] Preserve each handler's redirect status: `redirect(url)` from `remix/response/redirect`
      defaults to **302**. A frame-PRG handler that previously returned an explicit **303** must
      keep it (`new Response(null, { status: 303, ... })`); a status assertion in the test catches
      the regression.
- [ ] Admin-only SSE: auth-only `requireSseAuth()` over-permits. Use a role-aware guard returning
      plain 401/403 — not `requireAdmin`, whose redirect/HTML breaks `EventSource`. This repo's
      `requireAdminSseAuth()` (`app/middleware/sse-auth.ts`) is the pattern; see
      `remix3-standalone-route-admin-sidebar`.

## Route Deletion Sweep

When REMOVING a route entirely (not moving it), the reference sweep is wider than relocation — and a missed reference breaks the WHOLE test suite, not just the removed route.

### Sweep checklist (beyond relocation's items 1-4)

- [ ] `app/routes.ts` — remove the route tree AND its frame name from the `frames` const
- [ ] `app/router.ts` — remove `router.map(...)`
- [ ] `app/actions/admin/controller.tsx` — remove the re-export
- [ ] `app/ui/admin-layout.tsx` — nav item, icon case, `AdminNavItem` union member, `contentOnlyTargets`, `fullHeightTargets`
- [ ] `app/middleware/frame-redirect.ts` — remove the frame from `ADMIN_FRAME_TARGETS`
- [ ] `app/route-labels.ts` — remove the `ROUTE_LABELS` entry
- [ ] `app/ui/verwaltung-layout.tsx` — remove the frame from `FRAME_TARGETS`
- [ ] `app/utils/frame-target.ts` — remove the frame from `getSelfFrameTarget`
- [ ] `app/middleware/skip-csrf.ts` — remove the path from `AGENT_PATHS` (SSE/agent routes)

### The two gotchas

1. **Grep by the FRAME name, not the route path.** `frames.<name>` references live in `frame-redirect.ts`, `verwaltung-layout.tsx`, and `frame-target.ts` — a `grep "old/path" app/` misses them. Sweep with `grep -rn "<FrameName>\|routes.<tree>.<key>" app/`.
2. **The test runner loads every controller transitively via the router.** A broken import in a to-be-deleted controller (e.g. it imports a file you moved) fails the ENTIRE `remix test` run with a confusing `Cannot find module ... imported from <deleted-controller>` — even for unrelated test files. Delete/repair all references before running any test, or the suite never loads.
