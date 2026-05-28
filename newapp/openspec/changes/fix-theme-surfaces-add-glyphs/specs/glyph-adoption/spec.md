## ADDED Requirements

### Requirement: Application uses Glyph component for UI icons

The application SHALL use the `Glyph` component from `remix/ui/glyph` for all UI icons where a matching glyph name exists in the RMX_01 glyph set.

#### Scenario: Glyph component renders correct SVG icon
- **WHEN** a `<Glyph name="check" />` component is rendered
- **THEN** the output SHALL be an SVG element referencing the correct glyph sprite ID
- **AND** the SVG SHALL inherit `currentColor` for fill/stroke
- **AND** the SVG SHALL be hidden from assistive technology by default (`aria-hidden="true"`)

### Requirement: RMX_01_GLYPHS sprite is rendered in document shell

The document shell (`app/ui/document.tsx`) SHALL render the `RMX_01_GLYPHS` component from `remix/ui/theme` alongside the existing `RMX_01` theme stylesheet, making the glyph sprite available to all pages.

#### Scenario: Glyph sprite renders in HTML
- **WHEN** the document is rendered
- **THEN** the output SHALL contain the `<svg>` element with `aria-hidden="true"` containing all RMX_01 glyph definitions

### Requirement: Layout navigation icons use Glyph component

The app layout (`app/ui/layout.tsx`) SHALL use `Glyph` components for the logout action and theme toggle button, replacing the current hardcoded inline SVG and emoji icon.

#### Scenario: Logout button uses Glyph
- **WHEN** the layout header renders the logout button
- **THEN** the button SHALL contain a `<Glyph>` element instead of the current inline SVG

#### Scenario: Theme toggle uses Glyph
- **WHEN** the layout header renders the theme toggle button
- **THEN** the button SHALL use a `<Glyph>` element instead of the current emoji (🌓)

### Requirement: Sidebar navigation icons use Glyph component

The admin layout (`app/ui/admin-layout.tsx`) and AI layout (`app/ui/ai-layout.tsx`) sidebars SHALL use `Glyph` components for navigation link icons, replacing inline SVGs.

#### Scenario: Admin sidebar renders glyph icons
- **WHEN** the admin layout renders sidebar navigation links
- **THEN** each link SHALL use `<Glyph>` instead of inline SVG for its icon
- **AND** the glyph name SHALL match the link's semantic purpose

#### Scenario: AI sidebar renders glyph icons
- **WHEN** the AI layout renders sidebar navigation links
- **THEN** each link SHALL use `<Glyph>` instead of inline SVG for its icon

### Requirement: Lists client CRUD buttons use Glyph component

The lists client (`app/assets/lists-client.tsx`) SHALL use `<Glyph name="check" />` and `<Glyph name="close" />` for save/cancel/delete buttons instead of the current ✓ and ✕ text characters.

#### Scenario: Save button renders check glyph
- **WHEN** the lists client renders the save button
- **THEN** the button content SHALL include `<Glyph name="check" />`

#### Scenario: Cancel button renders close glyph
- **WHEN** the lists client renders a cancel or delete button
- **THEN** the button content SHALL include `<Glyph name="close" />`

### Requirement: Workflow page action icons use Glyph component

The workflow run page (`app/ui/workflow-page.tsx`) SHALL use `Glyph` components for select arrows, run action icons, and edit/delete actions where a glyph name match exists.

#### Scenario: Select dropdown uses chevron glyph
- **WHEN** the workflow page renders a select dropdown
- **THEN** the dropdown indicator SHALL use `<Glyph name="chevronDown" />`

#### Scenario: Action buttons use matching glyphs
- **WHEN** render, edit, or delete action buttons are rendered
- **THEN** they SHALL use `<Glyph name="edit" />` or `<Glyph name="trash" />` as appropriate
