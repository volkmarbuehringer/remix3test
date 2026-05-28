## ADDED Requirements

### Requirement: Surface level values follow RMX_01 elevation semantics

The theme surface levels (`lvl0`–`lvl4`) SHALL follow RMX_01 conventions where `lvl0` is the lightest/highest-elevation surface (cards, modals, raised panels) and `lvl4` is the darkest/deepest surface (subtle backgrounds, deepest trays).

#### Scenario: Light mode surfaces are ordered by elevation
- **WHEN** the light theme is applied
- **THEN** `lvl0` SHALL have the lightest value (`#f7fbff`)
- **AND** `lvl4` SHALL have the darkest value (`#dee2e6`)
- **AND** each level SHALL be visually distinguishable from adjacent levels
- **AND** no two levels SHALL share the same value

#### Scenario: Dark mode surfaces maintain correct ordering
- **WHEN** the dark theme (`[data-theme="dark"]`) is applied
- **THEN** `lvl0` SHALL be the lightest dark surface
- **AND** `lvl4` SHALL be the darkest dark surface
- **AND** the contrast ladder SHALL be consistent with light mode

### Requirement: Status surface tokens remain at current levels

The status surface tokens (`dangerBg`, `dangerText`, `dangerBorder`, `successBg`, `successText`, `successBorder`) are not elevation tokens and SHALL NOT be reordered — they remain at their current values in both light and dark themes.

#### Scenario: Status colors unchanged
- **WHEN** the surface level values are reordered
- **THEN** `surface.dangerBg` SHALL remain `#fef2f2` (light) / `#3b1111` (dark)
- **AND** `surface.successBg` SHALL remain `#f0fdf4` (light) / `#052e16` (dark)

### Requirement: Gray-blue palette is preserved

The corrected surface values SHALL maintain the same gray-blue color palette as the current theme — only the level assignments change, not the actual color values.

#### Scenario: No new colors introduced
- **WHEN** surface values are reordered
- **THEN** every value in the corrected `lvl0`–`lvl4` SHALL be one of the values from the current theme's level set
