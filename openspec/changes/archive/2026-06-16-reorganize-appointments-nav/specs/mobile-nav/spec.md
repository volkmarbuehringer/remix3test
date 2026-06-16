## ADDED Requirements

### Requirement: Desktop nav "Termine" points to appointments/new

The "Termine" entry in `NAV_SECTIONS` SHALL point to `/appointments/new` instead of `/appointment`.

#### Scenario: Termine links to new wizard
- **WHEN** a user clicks "Termine" in the desktop nav
- **THEN** they SHALL be navigated to `/appointments/new`

### Requirement: Desktop nav has "TermineUI" entry

`NAV_SECTIONS` SHALL contain a "TermineUI" entry pointing to `/appointment` in the same section as other nav items.

#### Scenario: TermineUI entry in desktop nav
- **WHEN** inspecting `NAV_SECTIONS` items
- **THEN** it SHALL contain an entry with `label: "TermineUI"` and `href: "/appointment"`
