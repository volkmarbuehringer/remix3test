## ADDED Requirements

### Requirement: Nav registry defines navigation items

The app SHALL export typed navigation data from `app/ui/nav.ts` consisting of `NavItem` objects with `label`, `href`, and optional `icon` and `adminOnly` fields, organized into `NavSection` groups. Each `NavSection` SHALL have an `id`, optional `label` for group headings, and an `items` array.

The registry SHALL be a `const` assertion so the routing and permissions types are derived.

#### Scenario: Nav registry is the single source of truth for nav items

- **WHEN** a new page is added to the app
- **THEN** adding an entry to the nav registry SHALL be the only step needed to make it appear in the navigation

### Requirement: Layout renders nav from registry

The `Layout` component SHALL import the nav registry and render navigation links from the `NavSection` array. Each link SHALL have active state detection (matching `href` against current path), a `NavLink` style using `navLinkStyle` and `navActiveStyle` CSS, and optional icon support.

The layout SHALL support role-based filtering: items with `adminOnly: true` SHALL only render when the current user is an admin.

#### Scenario: Active nav link is highlighted

- **WHEN** the current path is `/dashboard`
- **THEN** the nav link with href `/dashboard` SHALL have the active style applied (primary color, semibold weight)

#### Scenario: Admin-only items are hidden from non-admin users

- **WHEN** rendering nav for a non-admin user
- **THEN** any `NavItem` with `adminOnly: true` SHALL be excluded from the rendered navigation

### Requirement: Nav sections can have group labels

Sections in the nav registry MAY have an optional `label` string that renders as a group heading above the section's items.

#### Scenario: Section labels render as group headings

- **WHEN** a `NavSection` has `label: "Admin"`
- **THEN** the rendered nav SHALL show "Admin" as a group label above that section's items, styled as uppercase, muted, small text
