## ADDED Requirements

### Requirement: Sidebar pagination controls

The system SHALL display "Vorherige" and "Nächste" navigation buttons below the list entries in the sidebar when there are more lists than the current page can display.

#### Scenario: First page shows "Nächste" only

- **WHEN** user opens the lists sidebar and has more than 50 lists
- **THEN** the sidebar SHALL show a "Nächste" button below the list entries
- **AND** the sidebar SHALL NOT show a "Vorherige" button

#### Scenario: Middle page shows both buttons

- **WHEN** user has navigated past page 1 and there are more lists on the next page
- **THEN** the sidebar SHALL show both "Vorherige" and "Nächste" buttons

#### Scenario: Last page shows "Vorherige" only

- **WHEN** user is on the last page of lists
- **THEN** the sidebar SHALL show a "Vorherige" button
- **AND** the sidebar SHALL NOT show a "Nächste" button

#### Scenario: Fewer than 51 lists — no pagination shown

- **WHEN** user has 50 or fewer lists
- **THEN** the sidebar SHALL NOT show pagination buttons

#### Scenario: Pagination resets on list create or delete

- **WHEN** user creates or deletes a list while on a paginated page
- **THEN** the sidebar SHALL reload from offset 0 (first page)

### Requirement: Offset persisted in URL

The system SHALL track the current page via an `offset` query parameter in the URL.

#### Scenario: Navigating to next page updates offset

- **WHEN** user clicks "Nächste"
- **THEN** the URL SHALL be updated with `?offset=<current_offset + 50>`
- **AND** the sidebar SHALL display the next page of lists

#### Scenario: Navigating to previous page updates offset

- **WHEN** user clicks "Vorherige"
- **THEN** the URL SHALL be updated with `?offset=<current_offset - 50>`
- **AND** the sidebar SHALL display the previous page of lists

#### Scenario: Offset defaults to 0

- **WHEN** user visits the lists page without an `offset` parameter
- **THEN** the sidebar SHALL display the first page of lists (offset 0)

### Requirement: Active list highlight preserved within current page

The system SHALL highlight the currently active list in the sidebar.

#### Scenario: Active list on current page is highlighted

- **WHEN** user navigates to a list that exists on the current page
- **THEN** that list entry SHALL have the active highlight style

#### Scenario: Active list not on current page — no highlight

- **WHEN** user navigates to a list that is on a different page
- **THEN** no list entry SHALL be highlighted as active
