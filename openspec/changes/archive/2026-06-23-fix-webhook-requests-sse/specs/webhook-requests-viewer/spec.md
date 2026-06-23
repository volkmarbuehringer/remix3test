## MODIFIED Requirements

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
