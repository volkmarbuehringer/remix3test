## ADDED Requirements

### Requirement: Verwaltung route tree SHALL exist at /verwaltung

The system SHALL expose a route tree at the `/verwaltung` prefix containing sub-routes for offerings, appointments, resources, and offering-configs. The route tree SHALL be defined in `app/routes.ts` as a named export following the same structural pattern as the existing admin route tree.

#### Scenario: Route tree defined in routes.ts
- **WHEN** the application loads its route definitions from `app/routes.ts`
- **THEN** a `verwaltungRoutes` export SHALL exist with a `verwaltung` root route containing the four sub-routes

#### Scenario: Offerings sub-routes
- **WHEN** the verwaltung route tree is inspected
- **THEN** it SHALL contain an `offerings` route with `index` (GET /), `create` (POST /), `update` (PUT /:id), `destroy` (DEL /:id), `configSave` (POST /config), and `weekGenerate` (POST /week)

#### Scenario: Appointments sub-routes
- **WHEN** the verwaltung route tree is inspected
- **THEN** it SHALL contain an `appointments` route with `index` (GET /), `create` (POST /), `update` (PUT /:id), `destroy` (DEL /:id), and `events` (GET /events)

#### Scenario: Resources sub-routes
- **WHEN** the verwaltung route tree is inspected
- **THEN** it SHALL contain a `resources` route using the `resources()` helper with index, create, update, destroy

#### Scenario: Offering configs sub-routes
- **WHEN** the verwaltung route tree is inspected
- **THEN** it SHALL contain an `offeringConfigs` route using the `resources()` helper with index, create, update, destroy

### Requirement: Verwaltung controllers SHALL be wired in router.ts

The router SHALL map the verwaltung route tree and its sub-routes to their respective controllers.

#### Scenario: Dashboard controller mapping
- **WHEN** the router is initialized
- **THEN** `verwaltungRoutes.verwaltung` SHALL be mapped to the verwaltung controller for the dashboard index

#### Scenario: Sub-route controller mappings
- **WHEN** the router is initialized
- **THEN** `verwaltungRoutes.verwaltung.offerings` SHALL be mapped to the admin offerings controller
- **AND** `verwaltungRoutes.verwaltung.appointments` SHALL be mapped to the admin appointments controller
- **AND** `verwaltungRoutes.verwaltung.resources` SHALL be mapped to the admin resources controller
- **AND** `verwaltungRoutes.verwaltung.offeringConfigs` SHALL be mapped to the admin offering configs controller

### Requirement: Admin route tree SHALL exclude moved routes

The `adminRoutes` tree in `app/routes.ts` SHALL no longer contain `offerings`, `appointments`, `resources`, or `offeringConfigs` sub-routes. The admin sidebar nav SHALL not list these routes.

#### Scenario: Admin routes exclude offerings
- **WHEN** the admin route tree is inspected
- **THEN** it SHALL NOT contain an `offerings` sub-route

#### Scenario: Admin routes exclude appointments
- **WHEN** the admin route tree is inspected
- **THEN** it SHALL NOT contain an `appointments` sub-route

#### Scenario: Admin sidebar excludes moved nav items
- **WHEN** the admin layout renders
- **THEN** the sidebar SHALL NOT contain nav items for Angebote, Termine, Ressourcen, or Angebotskonfigurationen
