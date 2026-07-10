## ADDED Requirements

### Requirement: Admin can view monthly appointment summary

The system SHALL provide a report page at `/verwaltung/report1` that shows per-user appointment summaries for a selected year and month.

The report SHALL be accessible only to users with the `admin` role.

#### Scenario: Page loads with default year/month

- **WHEN** an admin navigates to `/verwaltung/report1`
- **THEN** the page SHALL default to the current year and current month
- **THEN** the page SHALL display a table of all users who have appointments in that month

#### Scenario: Year and month selection

- **WHEN** an admin selects a year via the year picker and a month via the month picker
- **THEN** the report SHALL update to show data for the selected year/month

#### Scenario: Filter by single user

- **WHEN** an admin selects a specific user from the user dropdown
- **THEN** the report SHALL show data only for that user
- **WHEN** an admin selects "Alle Benutzer" (all users) from the dropdown
- **THEN** the report SHALL show data for all users

### Requirement: Report table columns

The report table SHALL display the following columns per user:

- User name
- Appointment count
- Earliest appointment date (min date)
- Latest appointment date (max date)
- Total booked hours (sum of appointment durations, in hours with 1 decimal)
- Average hours per appointment (mean duration, in hours with 1 decimal)

#### Scenario: Table displays correctly

- **WHEN** the page loads with data
- **THEN** each row SHALL show one user with their appointment statistics for the selected month
- **THEN** the total hours SHALL be calculated as `SUM(end_min - start_min) / 60` rounded to 1 decimal
- **THEN** the average hours SHALL be calculated as `total_min / COUNT / 60` rounded to 1 decimal

#### Scenario: No appointments in selected period

- **WHEN** no appointments exist for the selected year/month
- **THEN** the page SHALL display an empty table with a message like "Keine Termine in diesem Zeitraum."

### Requirement: Grid sorting

The report table SHALL support sorting by any column in ascending or descending order.

#### Scenario: Sort by column

- **WHEN** an admin clicks a column header
- **THEN** the table SHALL sort by that column (ascending on first click)
- **WHEN** the admin clicks the same column header again
- **THEN** the sort direction SHALL toggle to descending
- **WHEN** the admin clicks a different column header
- **THEN** the table SHALL sort by the new column in ascending order

### Requirement: Grid pagination

The report SHALL paginate results with a page size of 20 rows.

#### Scenario: Navigate between pages

- **WHEN** the result set exceeds 20 users
- **THEN** pagination controls SHALL appear (previous/next buttons)
- **WHEN** an admin clicks "Next"
- **THEN** the table SHALL show the next 20 results
- **WHEN** an admin clicks "Previous"
- **THEN** the table SHALL show the previous 20 results

### Requirement: Text filter by user name

The report SHALL support a text filter that searches user names.

#### Scenario: Filter by name fragment

- **WHEN** an admin types a search term into the filter input
- **THEN** the table SHALL show only users whose name matches the search term (case-insensitive)
- **WHEN** the admin clears the filter
- **THEN** the table SHALL show all users again

### Requirement: Grid state preserved across actions

The report SHALL preserve the current grid state (sort, order, offset, filter, year, month, user_id) when the page is re-rendered or submitted.

#### Scenario: Grid state in URL

- **WHEN** an admin sets a filter, sort order, and navigates to page 2
- **THEN** the URL SHALL contain query params reflecting the current state
- **WHEN** the admin reloads the page
- **THEN** the grid state SHALL be restored from the URL params
