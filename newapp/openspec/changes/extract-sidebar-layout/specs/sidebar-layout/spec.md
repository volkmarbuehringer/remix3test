## ADDED Requirements

### Requirement: Sidebar layout factory

The system SHALL provide a `createSidebarLayout()` factory function that generates a reusable sidebar layout consisting of a sticky navigation sidebar and a content area arranged in a 2-column grid (`220px` sidebar, remainder content). The factory SHALL accept section-specific configuration for nav items, icons, header content, and optional extra components.

#### Scenario: Factory returns renderPage function

- **WHEN** a section module calls `createSidebarLayout(config)`
- **THEN** the returned object SHALL include a `renderPage` function that accepts `(render, activeItem, content, init?)` and returns a `Response`

#### Scenario: Factory returns Layout component

- **WHEN** a section module calls `createSidebarLayout(config)`
- **THEN** the returned object SHALL include a `Layout` Remix component that can receive `{ activeItem, children }` props

### Requirement: ShellOrFragment rendering

The sidebar layout SHALL implement the ShellOrFragment pattern: when the incoming request contains an `X-Remix-Target` header matching the layout's configured frame target, it SHALL render only the sidebar layout (for use inside a frame). Otherwise, it SHALL render the outer `Layout` wrapper containing a `<Frame>` pointed at the current URL.

#### Scenario: Full page request renders outer shell

- **WHEN** a request arrives WITHOUT the configured `X-Remix-Target` header
- **THEN** the layout SHALL render `<Layout><Frame name={target} src={url} /></Layout>`

#### Scenario: Frame request renders inner layout

- **WHEN** a request arrives WITH the configured `X-Remix-Target` header
- **THEN** the layout SHALL render only the sidebar shell (sidebar + content area) without the outer `Layout` wrapper

### Requirement: Navigation sidebar

The sidebar SHALL render a sticky aside element containing: a header row with icon and uppercase label, a horizontal divider, a vertical navigation list of grouped links, an optional second divider, and an optional extras slot. Each nav link SHALL support `rmx-target` for frame navigation and may optionally support `rmx-document` for full-page navigation.

#### Scenario: Nav links use frame navigation by default

- **WHEN** a nav item has `iframeNav: true` (or default)
- **THEN** the rendered link SHALL include `rmx-target={frameTarget}`

#### Scenario: Nav links can force full-page navigation

- **WHEN** a nav item has `iframeNav: false`
- **THEN** the rendered link SHALL include `rmx-document` attribute

#### Scenario: Active nav item is visually distinguished

- **WHEN** a nav item matches the `activeItem` prop
- **THEN** it SHALL have a colored left border, stronger text weight, and elevated background

### Requirement: Nav link styles

The sidebar layout SHALL define shared CSS styles for nav links including: hover state with background change, active state with left border accent, icon alignment, and group label formatting. These styles SHALL be defined once in the shared module and not duplicated per section.

#### Scenario: Nav link renders with correct structure

- **WHEN** a nav link renders
- **THEN** it SHALL contain an icon element and a label, aligned horizontally with gap spacing

#### Scenario: Group labels are rendered when present

- **WHEN** a nav group has a `label`
- **THEN** a muted, uppercase label SHALL render above the group's items
