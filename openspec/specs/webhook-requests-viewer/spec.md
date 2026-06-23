## Purpose

An SSR page for inspecting received webhook requests with paging, sorting, filtering, and live SSE-driven refresh. Provides administrative visibility into webhook traffic.

## Requirements

### Requirement: SSR page with table of webhook requests

The system SHALL render an SSR page at `/webhook-requests` displaying the contents of the `webhook_requests` table with a per-row resend action.

#### Scenario: Page renders with data

- **WHEN** a user navigates to `/webhook-requests`
- **THEN** the page SHALL display a table of webhook requests with columns: created_at, payload (truncated), token, source_ip, callback_received_at
- **THEN** each row SHALL include a "Resenden" action button
- **THEN** empty state SHALL display a "No requests yet" message

### Requirement: Paging

The table SHALL support pagination with configurable page size.

#### Scenario: Navigate between pages

- **WHEN** the table has more rows than the page size
- **THEN** pagination controls SHALL be displayed
- **WHEN** a user clicks "Next" or a page number
- **THEN** the table SHALL display the corresponding page of results

### Requirement: Sorting

The table SHALL support sorting by any column (created_at, token, source_ip, callback_received_at).

#### Scenario: Sort by column

- **WHEN** a user clicks a column header
- **THEN** the table SHALL sort by that column (ascending on first click, descending on second click)
- **THEN** the current sort direction SHALL be reflected visually

### Requirement: Filtering

The table SHALL support filtering by payload content and token value.

#### Scenario: Filter by token

- **WHEN** a user enters text in a filter input
- **THEN** the table SHALL only show rows where the token matches the filter text

### Requirement: SSE-driven live refresh

The page SHALL connect to an SSE endpoint using the `ConnectionIndicator` clientEntry component and refresh the table when new data arrives.

#### Scenario: Auto-refresh on new request

- **WHEN** a new webhook request is received
- **THEN** the SSE endpoint SHALL push an `invalidate` event to connected clients
- **WHEN** the viewer page receives this event via `ConnectionIndicator`
- **THEN** the page SHALL reload using `window.location.reload()`
- **AND** the URL SHALL NOT accumulate cache-busting parameters

#### Scenario: Auto-refresh on callback received

- **WHEN** a callback is received for an existing webhook request
- **THEN** the SSE endpoint SHALL push an `invalidate` event to connected clients
- **WHEN** the viewer page receives this event via `ConnectionIndicator`
- **THEN** the page SHALL reload using `window.location.reload()`

#### Scenario: Connection status visible

- **WHEN** the webhook-requests page renders
- **THEN** a connection status indicator SHALL be displayed showing whether the SSE connection is active, reconnecting, or disconnected
