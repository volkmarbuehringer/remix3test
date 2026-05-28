## ADDED Requirements

### Requirement: Lists entry appears in nav registry

The `NAV_SECTIONS` array in `app/ui/nav.ts` SHALL include a "Lists" `NavItem` with `href: '/lists'` so the Lists page is discoverable from the header navigation.

#### Scenario: Lists link renders in nav

- **WHEN** the app renders the layout
- **THEN** the nav SHALL contain a link with label "Lists" pointing to `/lists`

### Requirement: Lists nav link shows active state

When the current path starts with `/lists`, the Lists nav link SHALL have the active style applied (primary color, semibold weight) to indicate the current page.

#### Scenario: Lists link is active on /lists page

- **WHEN** the current path is `/lists`
- **THEN** the Lists nav link SHALL have the active style applied
