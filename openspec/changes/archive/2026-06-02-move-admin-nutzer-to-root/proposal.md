## Why

The Nutzer (user management) page is the most frequently used admin page but it's buried under `/admin/nutzer` in the sidebar, requiring two clicks and a context switch away from the main navigation. Moving it to a top-level `/nutzer` route with a direct navbar link gives administrators immediate access. At the same time, the current form validation uses error redirects that lose all submitted field values — upgrading to the `parseSafe` + `context.render()` pattern (already proven at `/client`) preserves user input on validation failure.

## What Changes

- **Route move**: Relocate `nutzer` route tree from `adminRoutes.admin.nutzer` to a top-level `/nutzer` route in the main `routes` definition, with the same CRUD + toggle/reset endpoints.
- **Navbar entry**: Add "Nutzer" link to `NAV_SECTIONS` in the main navigation bar, marked `adminOnly`.
- **Admin sidebar cleanup**: Remove the "Nutzer" item from the admin sidebar `NAV_GROUPS`.
- **Form validation upgrade**: Replace `buildNutzerErrorRedirect()` in the controller with `parseSafe` + `issuesToFieldErrors` + `readFormFieldValues` + `context.render()`, matching the `/client` pattern. On validation failure, re-render the page at status 400 with `formValues` and `fieldErrors` props — no redirect, no lost input.
- **Form component props**: Add `formValues` and `fieldErrors` props to `AdminNutzerEditPage` and `AdminNutzerCreatePage`, render `value={formValues?.field ?? defaultValue}` on inputs and per-field error messages with error styling.
- **Rendering**: Switch from `renderAdminPage()` (admin sidebar frame layout) to `Layout` (main page layout) for the Nutzer page controller.
- **Base URL**: All internal links in the nutzer page components (`/admin/nutzer` → `/nutzer`) and the context menu asset update accordingly.

## Capabilities

### New Capabilities

- `top-level-nutzer-route`: The Nutzer page accessible at `/nutzer` with a direct main-nav link, rendered in the standard `Layout` (not admin frame layout), requiring auth + admin middleware.
- `nutzer-form-render-validation`: Nutzer create and update forms that use `parseSafe` validation with `context.render()` on failure, preserving submitted field values and showing per-field error messages — matching the `/client` form behavior.

### Modified Capabilities

- `form-validation`: The "Validation failure re-renders form page" and "Form inputs render error styling on validation failure" requirements now apply to nutzer forms in addition to client forms.
- `nutzer-context-menu`: All internal URLs referencing `/admin/nutzer` in the context menu handlers and route definitions must be updated to `/nutzer`.

## Impact

- `app/routes.ts` — move `nutzer` route from `adminRoutes.admin` to a new top-level `nutzer` route, update paths
- `app/router.ts` — remap nutzer controller from `adminRoutes.admin.nutzer` to the new top-level route
- `app/ui/nav.ts` — add `{ label: 'Nutzer', href: '/nutzer', adminOnly: true }` to `NAV_SECTIONS`
- `app/ui/admin-layout.tsx` — remove `'nutzer'` from `AdminNavItem` type, `NAV_GROUPS`, and `navIcon` switch
- `app/actions/admin-nutzer-controller.tsx` — replace `renderAdminPage` with `Layout` rendering; replace `buildNutzerErrorRedirect` with `parseSafe` + `context.render()`; use `readFormFieldValues` and `issuesToFieldErrors`; add `minLength`/`email` schema checks
- `app/ui/admin-nutzer-page.tsx` — change `ADMIN_BASE` to `/nutzer`; accept and pass through `formValues`/`fieldErrors` props; remove `rmx-target={frames.adminContent}` attributes
- `app/ui/admin-nutzer-edit-page.tsx` — accept `formValues`/`fieldErrors` props; render `value` attributes from formValues fallback; add per-field error display and error styling; update internal URLs
- `app/ui/admin-nutzer-create-page.tsx` — accept `formValues`/`fieldErrors` props; same pattern as edit page
- `app/assets/nutzer-table-interactive.tsx` — update all URLs from `/admin/nutzer` to `/nutzer`
