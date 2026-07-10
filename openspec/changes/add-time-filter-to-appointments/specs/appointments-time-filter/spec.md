## ADDED Requirements

### Requirement: Admin can filter appointments by time period

The system SHALL provide time-period filter buttons on the admin appointments page that filter the appointments list by the `day` column.

#### Scenario: Show all appointments (no filter)

- **WHEN** admin navigates to `/verwaltung/appointments` without a `period` query parameter
- **THEN** the system displays all appointments sorted by the current sort column
- **AND** the "Alle" button is highlighted as active

#### Scenario: Filter by current week

- **WHEN** admin clicks the "Diese Woche" button
- **THEN** the system filters appointments to those with `day` within the current ISO week (Monday 00:00 to next Monday 00:00 UTC)
- **AND** the "Diese Woche" button is highlighted as active

#### Scenario: Filter by next week

- **WHEN** admin clicks the "Nächste Woche" button
- **THEN** the system filters appointments to those with `day` within the next ISO week
- **AND** the "Nächste Woche" button is highlighted as active

#### Scenario: Filter by current month

- **WHEN** admin clicks the "Diesen Monat" button
- **THEN** the system filters appointments to those with `day` within the current calendar month (1st 00:00 to next month 1st 00:00 UTC)
- **AND** the "Diesen Monat" button is highlighted as active

#### Scenario: Filter by next month

- **WHEN** admin clicks the "Nächsten Monat" button
- **THEN** the system filters appointments to those with `day` within the next calendar month
- **AND** the "Nächsten Monat" button is highlighted as active

### Requirement: Period filter preserves grid state across navigation

The system SHALL preserve the current sort column, sort order, text filter, and pagination offset when applying a period filter.

#### Scenario: Period filter preserves sort and filter

- **WHEN** admin has sorted by "Title" descending with a text filter "test" at page 2
- **AND** admin clicks "Diese Woche"
- **THEN** the URL contains `sort=title`, `order=desc`, `filter=test`, `offset=20`, and `period=this-week`

#### Scenario: Clicking active period resets filter

- **WHEN** the "Diese Woche" filter is active
- **AND** admin clicks "Diese Woche" again
- **THEN** the `period` query parameter is removed from the URL
- **AND** all appointments are shown (no period filter applied)

### Requirement: Period filter persists through create and edit form submissions

The system SHALL preserve the period filter when submitting create or edit forms on the admin appointments page.

#### Scenario: Period preserved after creating appointment

- **WHEN** admin has "Diese Woche" filter active
- **AND** admin creates a new appointment via the create form
- **THEN** after form submission, the page reloads with `period=this-week` in the URL
- **AND** the filtered list is still displayed

#### Scenario: Period preserved after editing appointment

- **WHEN** admin has "Nächste Woche" filter active
- **AND** admin edits an appointment via the edit form
- **THEN** after form submission, the page reloads with `period=next-week` in the URL
- **AND** the filtered list is still displayed
