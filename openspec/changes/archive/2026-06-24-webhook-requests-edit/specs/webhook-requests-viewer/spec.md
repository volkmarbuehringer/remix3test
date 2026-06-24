## ADDED Requirements

### Requirement: Edit action in webhook requests table

The webhook requests table SHALL include an "Edit" button in the Aktion column for each row.

#### Scenario: Edit link renders per row

- **WHEN** the admin views `/webhook-requests`
- **THEN** each row SHALL display an "Edit" link in the Aktion column alongside the existing "Resenden" button
- **AND** clicking "Edit" SHALL navigate to `?editing=<id>` with current pagination, sort, and filter parameters preserved

#### Scenario: Two-column layout when editing active

- **WHEN** the URL contains `?editing=<id>`
- **THEN** the page SHALL render in a two-column layout: grid on the left (min-width 0) and a sticky edit panel on the right (380px wide)
- **WHEN** no `?editing=` parameter is present
- **THEN** the page SHALL render as a single-column layout as before

#### Scenario: Edited row highlighted

- **WHEN** `?editing=<id>` is active
- **THEN** the corresponding row SHALL have `editingRow` styling applied (outline and background highlight)
