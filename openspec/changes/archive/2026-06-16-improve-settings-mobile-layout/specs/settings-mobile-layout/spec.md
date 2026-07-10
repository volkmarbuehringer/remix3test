## ADDED Requirements

### Requirement: Compact delete account panel spacing

The settings page "Konto löschen" panel SHALL use compact spacing appropriate for its sparse content:

- `deletePanelCss` SHALL have `padding: theme.space.md` (12px) instead of `lg` (16px) on all viewports
- `deletePanelCss` SHALL NOT have any `marginTop`
- `warningTextCss` SHALL use `marginBottom: theme.space.sm` (8px) instead of `md` (12px)
- On viewports ≤768px, the delete form grid gap SHALL be `theme.space.sm` (8px) instead of `md` (12px)
- On viewports ≤768px, the submit button vertical padding SHALL be reduced from 12px to 8px

#### Scenario: Delete panel has no extra margin top

- **WHEN** the settings page renders
- **THEN** the "Konto löschen" panel SHALL have the same vertical gap from the section above as other panels (controlled by PageSection gap)

#### Scenario: Delete panel padding is reduced from desktop default

- **WHEN** the settings page renders on any viewport
- **THEN** the "Konto löschen" panel SHALL have 12px internal padding instead of the standard 16px

#### Scenario: Mobile delete form uses tighter grid gap

- **WHEN** the settings page is viewed at ≤768px viewport width
- **THEN** the delete account form grid gaps SHALL be 8px

#### Scenario: Desktop delete form uses standard grid gap

- **WHEN** the settings page is viewed at >768px viewport width
- **THEN** the delete account form grid gaps SHALL be 12px

### Requirement: All settings panels use consistent section spacing

The section gap between all settings panels SHALL be uniform. No panel SHALL have extra margin top beyond the PageSection gap.

#### Scenario: All panels are evenly spaced

- **WHEN** the settings page renders
- **THEN** each panel after the first SHALL have identical vertical separation from the previous panel
