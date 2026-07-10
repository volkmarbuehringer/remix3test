## ADDED Requirements

### Requirement: Showcase items are accessible via a dropdown menu

The navbar SHALL replace inline Showcase links with a single "Showcase" button that opens a dropdown menu.

#### Scenario: Showcase button replaces inline links

- **WHEN** the navbar is rendered
- **THEN** the Showcase section items SHALL NOT appear as direct links in the navbar
- **AND** a single "Showcase" button SHALL appear in place of the previous inline links

#### Scenario: Dropdown opens on click

- **WHEN** a user clicks the "Showcase" button
- **THEN** a dropdown menu SHALL appear below the button containing all showcase item links

#### Scenario: Dropdown closes on second click

- **WHEN** a user clicks the "Showcase" button while the dropdown is open
- **THEN** the dropdown SHALL close

#### Scenario: Dropdown closes on click outside

- **WHEN** a user clicks outside the dropdown while it is open
- **THEN** the dropdown SHALL close

#### Scenario: Dropdown closes on Escape

- **WHEN** a user presses the Escape key while the dropdown is open
- **THEN** the dropdown SHALL close

#### Scenario: Dropdown closes on link click

- **WHEN** a user clicks a showcase link inside the dropdown
- **THEN** the dropdown SHALL close (after navigation)

### Requirement: Showcase button shows active state

The "Showcase" button SHALL display an active visual state when a showcase page is currently selected.

#### Scenario: Active state when on a showcase page

- **WHEN** the current route path matches any showcase item's href
- **THEN** the "Showcase" button SHALL have an active visual style

#### Scenario: No active state on non-showcase pages

- **WHEN** the current route path does not match any showcase item's href
- **THEN** the "Showcase" button SHALL NOT have an active visual style

### Requirement: Dropdown has consistent visual styling

The dropdown menu SHALL be styled consistently with the existing design system.

#### Scenario: Dropdown is a rounded panel

- **WHEN** the dropdown is visible
- **THEN** it SHALL have a background color matching the surface level, a border, rounded corners, a shadow, and links styled consistently with other nav links
