## ADDED Requirements

### Requirement: Breadcrumb labels for all Verwaltung sub-routes

The system SHALL provide a human-readable breadcrumb label for every navigable Verwaltung sub-route in the `ROUTE_LABELS` map.

#### Scenario: Report1 page shows correct breadcrumb

- **WHEN** a user navigates to `/verwaltung/report1`
- **THEN** the breadcrumb trail SHALL show "Verwaltung > Monatsauswertung"

#### Scenario: PDF export page shows correct breadcrumb

- **WHEN** a user navigates to `/verwaltung/pdf`
- **THEN** the breadcrumb trail SHALL show "Verwaltung > PDF-Export"

#### Scenario: Users export page shows correct breadcrumb

- **WHEN** a user navigates to `/verwaltung/users-export`
- **THEN** the breadcrumb trail SHALL show "Verwaltung > Benutzer-Export"

#### Scenario: Unknown Verwaltung sub-route shows parent breadcrumb

- **WHEN** a user navigates to a Verwaltung sub-route that has no direct label entry but has a labeled parent
- **THEN** the breadcrumb SHALL fall back to the nearest labeled parent path
