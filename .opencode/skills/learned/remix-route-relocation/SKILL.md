---
name: remix-route-relocation
description: Relocate Remix 3 routes between route trees — moving from admin frame-sidebar to top-level, frame to full-page, or upgrading form validation from error-redirect to parseSafe + context.render. Use when moving a route out of a frame layout or upgrading form error handling.
---

# Remix 3 Route Relocation & Form Validation Upgrade

Use this skill when relocating a Remix 3 route between route trees (e.g. from admin sidebar to top-level) or upgrading form validation from URL-redirect to `parseSafe` + `context.render()`.

## Route Relocation Checklist

When moving a route from one tree to another (e.g. `adminRoutes.admin.foo` → `routes.foo`):

### 1. Route Definition (routes.ts)

- [ ] Move the route entry to the target tree
- [ ] Remove from the source tree
- [ ] Verify path nesting — `route('foo')` under top-level produces `/foo`

### 2. Router Mapping (router.ts)

- [ ] Update `router.map(<newRouteRef>, <controller>)` to reference the new location

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
