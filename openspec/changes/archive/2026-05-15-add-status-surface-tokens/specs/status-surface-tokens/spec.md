## ADDED Requirements

### Requirement: Status surface tokens in theme

The theme SHALL provide `surface.danger` and `surface.success` tokens, each containing `bg`, `text`, and `border` sub-values, for both light and dark mode variants.

#### Scenario: Light theme has danger surface
- **WHEN** the light theme is active (no `data-theme` attribute)
- **THEN** `theme.surface.danger.bg` SHALL equal `#fef2f2`
- **THEN** `theme.surface.danger.text` SHALL equal `#991b1b`
- **THEN** `theme.surface.danger.border` SHALL equal `#fecaca`

#### Scenario: Light theme has success surface
- **WHEN** the light theme is active
- **THEN** `theme.surface.success.bg` SHALL equal `#f0fdf4`
- **THEN** `theme.surface.success.text` SHALL equal `#166534`
- **THEN** `theme.surface.success.border` SHALL equal `#bbf7d0`

#### Scenario: Dark theme has danger surface
- **WHEN** `data-theme="dark"` is set
- **THEN** `theme.surface.danger.bg` SHALL be a dark-appropriate red tint
- **THEN** `theme.surface.danger.text` SHALL be readable on that background

#### Scenario: Dark theme has success surface
- **WHEN** `data-theme="dark"` is set
- **THEN** `theme.surface.success.bg` SHALL be a dark-appropriate green tint
- **THEN** `theme.surface.success.text` SHALL be readable on that background
