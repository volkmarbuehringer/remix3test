## Purpose

SSE-driven live refresh for the webhook-requests viewer page using the standard `ConnectionIndicator` clientEntry component and `invalidate` event pattern, replacing the brittle inline-script approach.

## Requirements

### Requirement: ClientEntry-based SSE subscription

The webhook-requests page SHALL use the `ConnectionIndicator` clientEntry component for SSE subscription instead of an inline `<script>`.

#### Scenario: ConnectionIndicator renders with correct URL

- **WHEN** the webhook-requests page renders
- **THEN** a `ConnectionIndicator` SHALL be displayed near the page header
- **AND** the indicator SHALL subscribe to the `/webhook-requests/events` SSE endpoint
- **AND** the indicator SHALL show the real-time connection state (connected/reconnecting/disconnected)

### Requirement: Invalidate event triggers page reload

The webhook channel SHALL broadcast an `invalidate` event alongside `new_request` and `callback_received` events, so the `ConnectionIndicator` can trigger a page reload using its standard `invalidate` event handler.

#### Scenario: Invalidate on new request

- **WHEN** a new webhook request is received and `webhookChannel.broadcast('new_request')` is called
- **THEN** `webhookChannel.broadcast('invalidate')` SHALL also be called
- **AND** all connected clients SHALL receive both events

#### Scenario: Invalidate on callback received

- **WHEN** a callback is received and `webhookChannel.broadcast('callback_received')` is called
- **THEN** `webhookChannel.broadcast('invalidate')` SHALL also be called
- **AND** all connected clients SHALL receive both events

### Requirement: Page refresh without cache-busting parameter

The page SHALL reload using `window.location.reload()` (via `ConnectionIndicator`'s `reloadMode="window"` behavior) instead of constructing a new URL with a `_t` cache-busting parameter.

#### Scenario: Reload triggered by invalidate

- **WHEN** the `ConnectionIndicator` receives an `invalidate` event
- **THEN** the page SHALL call `window.location.reload()`
- **AND** the URL SHALL NOT accumulate `_t` or other cache-busting parameters
