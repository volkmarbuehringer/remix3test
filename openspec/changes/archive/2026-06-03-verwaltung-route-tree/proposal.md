## Why

The current `/admin` route tree mixes operational data management (offerings, appointments, resources, offering-configs) with system administration (users, chat logs, messages, lists). A new `/verwaltung` route tree separates the operational data management into its own section with a simpler dashboard layout — no sidebar, just a clean hub page with navigation cards. This is also groundwork for upgrading the form handling in these four routes to move away from URL-encoded form state toward a state-preserving pattern on validation errors.

## What Changes

- Create a new **verwaltung route tree** at `/verwaltung` with routes for offerings, appointments, resources, and offering-configs
- Create a **simple dashboard page** at `/verwaltung` — card-based navigation without a sidebar layout
- Move offerings, appointments, resources, and offering-configs routes from under `/admin/` to `/verwaltung/`
- Create a new **verwaltung controller** for the dashboard index action
- Update the four resource controllers to use verwaltung route references instead of admin routes
- Update router.ts to wire the verwaltung route tree to controllers
- Update sidebar layout to remove the four moved items from admin nav

## Capabilities

### New Capabilities

- `verwaltung-dashboard`: Simple dashboard at `/verwaltung` with card-based navigation linking to offerings, appointments, resources, and offering-configs — no sidebar layout, full-page navigation
- `verwaltung-route-tree`: New route tree definition at `/verwaltung/*` containing the four operational data routes

### Modified Capabilities

- `admin-offerings-form-validation`: Route contract changes from `/admin/offerings` to `/verwaltung/offerings` — controller references and URL patterns change but form behavior and validation logic remain identical
- `appointment-calendar`: Route contract changes from `/admin/appointments` to `/verwaltung/appointments`

## Impact

- **routes.ts**: New `verwaltung` route tree added; offerings/appointments/resources/offeringConfigs removed from `adminRoutes`
- **router.ts**: New controller mappings for verwaltung; four admin mappings removed
- **New files**: `app/actions/verwaltung-controller.tsx`, `app/ui/verwaltung-page.tsx`, `app/ui/verwaltung-layout.tsx`
- **Modified files**: `app/ui/admin-layout.tsx` (remove nav items), `app/actions/admin-offerings-controller.tsx`, `app/actions/admin-appointments-controller.tsx`, `app/actions/admin-resources-controller.tsx`, `app/actions/admin-offering-configs-controller.tsx` (route references)
- **Tests**: Update route references in test files for the four controllers
