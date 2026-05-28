## ADDED Requirements

### Requirement: Showcase route at /ui

The app SHALL provide a `/ui` route that displays a component showcase. The route SHALL have an index page listing all showcased components, and individual pages for each component (e.g., `/ui/button`, `/ui/form`, `/ui/theme`).

The showcase SHALL use the same mixins, page primitives, and theme tokens as the rest of the app.

#### Scenario: /ui route renders component overview

- **WHEN** navigating to `/ui`
- **THEN** the page SHALL display a list of link cards for each showcased component, styled with `ShowcaseLinkCard` from page-primitives

#### Scenario: Individual component page renders variants

- **WHEN** navigating to `/ui/button`
- **THEN** the page SHALL display each button variant (primary, secondary, ghost, danger) as a live rendered example

### Requirement: Showcase pages are easy to add

Each component page SHALL be a separate file in `app/actions/ui/pages/` that exports a render function. Adding a new showcase page SHALL require: creating the page file, adding a route in `routes.ts`, and adding the page entry to the showcase controller's page map.

#### Scenario: New component page follows simple template

- **WHEN** adding a new showcase page
- **THEN** the page file SHALL be ~20 lines: import primitives, import components, render `PageSection` with `ExamplePreview` cards inside

### Requirement: Example preview shows code alongside component

The showcase SHALL provide an inline preview pattern where each example shows the rendered component alongside its corresponding JSX source code, styled as a split card.

#### Scenario: Example renders component and code side by side

- **WHEN** a showcase page renders an example
- **THEN** the example card SHALL show the live component on top and the source code below in a monospace panel
