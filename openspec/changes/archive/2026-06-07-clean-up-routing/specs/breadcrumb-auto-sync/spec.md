## MODIFIED Requirements

### Requirement: All active routes have breadcrumb coverage

A route label registry derived from the typed route objects in `app/routes.ts` SHALL provide entries for every active route in the application, ensuring `getBreadcrumbs()` produces a meaningful trail on every page. This replaces the previous hand-maintained `ROUTE_LABELS` string map in `app/ui/route-labels.ts`.

#### Scenario: Admin nutzer pages show breadcrumbs
- **WHEN** a user navigates to `/admin/nutzer`
- **THEN** the breadcrumb trail SHALL include "Admin" as an intermediate step
- **AND** the current page label SHALL be "Nutzer" (or similar meaningful label)
- **AND** breadcrumbs SHALL also work for `/admin/nutzer/create` and `/admin/nutzer/:id/edit`

#### Scenario: Admin offerings pages show breadcrumbs
- **WHEN** a user navigates to `/admin/offerings`
- **THEN** the breadcrumb trail SHALL include "Admin" as an intermediate step
- **AND** the current page label SHALL be a meaningful label (e.g., "Offerings" or "Leistungen")
- **AND** breadcrumbs SHALL also work for sub-pages (`/admin/offerings/create`, `/admin/offerings/:id/edit`, etc.)

#### Scenario: Admin appointments pages show breadcrumbs
- **WHEN** a user navigates to `/admin/appointments`
- **THEN** the breadcrumb trail SHALL include "Admin" as an intermediate step
- **AND** the current page label SHALL be a meaningful label (e.g., "Appointments" or "Termine")
- **AND** breadcrumbs SHALL also work for sub-pages (`/admin/appointments?editing=X`, `/admin/appointments?creating`)

#### Scenario: Appointment public pages show breadcrumbs
- **WHEN** a user navigates to `/appointment`
- **THEN** the breadcrumb trail SHALL include a meaningful label for the appointment section

#### Scenario: Workflow pages show breadcrumbs
- **WHEN** a user navigates to `/ai/workflow`
- **THEN** the breadcrumb trail SHALL include "AI Dashboard" and "Workflows"
- **AND** breadcrumbs SHALL also work for `/ai/workflow/run`

#### Scenario: Client lab sub-pages show breadcrumbs
- **WHEN** a user navigates to `/client/create` or `/client/edit/:id`
- **THEN** the breadcrumb trail SHALL include "Client Lab" and a specific page label
