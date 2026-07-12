## ADDED Requirements

### Requirement: Slot button text visible in all themes
The slot picker buttons SHALL display the time label (e.g., "10:00–11:00") in legible contrast in both light and dark theme modes.

#### Scenario: Light mode button visible
- **WHEN** the theme is light (no `data-theme` attribute on `<html>`)
- **THEN** the slot button text SHALL be dark (`--rmx-color-text-primary`) on a light background (`--rmx-surface-lvl1`)

#### Scenario: Dark mode button visible
- **WHEN** the theme is dark (`data-theme="dark"` on `<html>`)
- **THEN** the slot button text SHALL be light (`--rmx-color-text-primary`) on a dark background (`--rmx-surface-lvl1`)

### Requirement: Tool card buttons also themed
The `renderSlotButtons()` rendering inside the collapsible tool card SHALL use the same correct `--rmx-*` CSS variables for button background, text color, and border color.

#### Scenario: Tool card buttons inherit correct theme
- **WHEN** a tool card containing slot buttons is rendered inside the chat stream
- **THEN** the buttons SHALL use `--rmx-surface-lvl1`, `--rmx-color-text-primary`, and `--rmx-color-border-default`

### Requirement: Slots are paginated client-side
The slot picker SHALL partition available slots into pages and show at most `SLOTS_PER_PAGE` slots per page. A pagination bar with "← Zurück" and "Weiter →" buttons SHALL let the user navigate between pages.

#### Scenario: First page shown on render
- **WHEN** the slot picker is rendered with more than `SLOTS_PER_PAGE` slots
- **THEN** only the first `SLOTS_PER_PAGE` slots SHALL be visible
- **AND** the pagination bar SHALL display "Seite 1 von N"

#### Scenario: Navigate to next page
- **WHEN** the user clicks "Weiter →"
- **THEN** the next page of slots SHALL be shown
- **AND** "← Zurück" SHALL become enabled

#### Scenario: Navigate to previous page
- **WHEN** the user clicks "← Zurück" on a page > 1
- **THEN** the previous page of slots SHALL be shown

#### Scenario: Previous disabled on first page
- **WHEN** the user is on page 1
- **THEN** "← Zurück" SHALL be disabled (or hidden)

#### Scenario: Next disabled on last page
- **WHEN** the user is on the last page
- **THEN** "Weiter →" SHALL be disabled (or hidden)

#### Scenario: Single page = no pagination bar
- **WHEN** the total slot count is ≤ `SLOTS_PER_PAGE`
- **THEN** no pagination bar SHALL be shown

### Requirement: Agent receives only selected slot
When the user clicks a slot button, the `handleSlotClick` handler SHALL send only that slot's data to the agent (resourceId, dateEpochMs, startMin, label, resourceName). The agent SHALL never know about pages or which page the slot was on.

#### Scenario: Slot click sends correct data
- **WHEN** the user clicks a slot button on any page
- **THEN** the `data-slot` attribute SHALL contain the same full slot data regardless of which page it appears on
- **AND** the POST to `/chat` SHALL include only that one slot's information
