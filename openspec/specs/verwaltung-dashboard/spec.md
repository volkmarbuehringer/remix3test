## ADDED Requirements

### Requirement: Verwaltung dashboard renders at /verwaltung

The system SHALL render a dashboard page at `/verwaltung` accessible only to authenticated admin users. The dashboard SHALL use a full-page layout without a sidebar and SHALL contain navigation cards linking to offerings, appointments, resources, and offering-configs sub-routes.

#### Scenario: Admin visits /verwaltung
- **WHEN** an authenticated admin user navigates to `/verwaltung`
- **THEN** the system renders a page with navigation cards for Angebote, Termine, Ressourcen, and Angebotskonfigurationen
- **AND** the page does NOT display a sidebar

#### Scenario: Unauthenticated user visits /verwaltung
- **WHEN** an unauthenticated user navigates to `/verwaltung`
- **THEN** the system SHALL redirect to the login page

#### Scenario: Non-admin user visits /verwaltung
- **WHEN** an authenticated non-admin user navigates to `/verwaltung`
- **THEN** the system SHALL return a 403 or redirect away

### Requirement: Dashboard navigation cards SHALL link to sub-routes

Each navigation card on the verwaltung dashboard SHALL link to its corresponding sub-route using full-page navigation (not frame-based).

#### Scenario: Click Angebote card
- **WHEN** user clicks the Angebote navigation card
- **THEN** the browser navigates to `/verwaltung/offerings`

#### Scenario: Click Termine card
- **WHEN** user clicks the Termine navigation card
- **THEN** the browser navigates to `/verwaltung/appointments`

#### Scenario: Click Ressourcen card
- **WHEN** user clicks the Ressourcen navigation card
- **THEN** the browser navigates to `/verwaltung/resources`

#### Scenario: Click Angebotskonfigurationen card
- **WHEN** user clicks the Angebotskonfigurationen navigation card
- **THEN** the browser navigates to `/verwaltung/offering-configs`
