## Purpose

A reusable client-side connection status indicator that shows whether an SSE subscription is active, disconnected, or reconnecting. Provides visual feedback so users know when real-time updates are flowing.

## Requirements

### Requirement: Connection status indicator component

The system SHALL provide a `ConnectionIndicator` `clientEntry` asset that displays the current state of an SSE connection.

#### Scenario: Connected state

- **WHEN** the SSE connection is open (the `EventSource.onopen` event fires or a custom `connected` event is received)
- **THEN** the indicator SHALL display a green pulsing dot
- **AND** the indicator SHALL display the text "Connected" or "Live"
- **AND** the indicator SHALL convey the connected state via text content (not just color), for accessibility

#### Scenario: Disconnected state

- **WHEN** the SSE connection is closed or fails (the `EventSource.onerror` event fires and connection does not recover within a timeout)
- **THEN** the indicator SHALL display a red static dot
- **AND** the indicator SHALL display the text "Disconnected"
- **AND** the indicator SHALL visually distinguish this state from the connected state via both color and text

#### Scenario: Reconnecting state

- **WHEN** the SSE connection fails and the browser's `EventSource` attempts to reconnect
- **THEN** the indicator SHALL display a yellow/orange dot
- **AND** the indicator SHALL display the text "Reconnecting..."
- **AND** this state SHALL be shown during the gap between `error` and the next successful `open` event

### Requirement: Configurable subscription URL

The `ConnectionIndicator` SHALL accept a subscription URL as a prop, enabling it to be used with any SSE endpoint.

#### Scenario: URL prop

- **WHEN** `<ConnectionIndicator url="/admin/messages/subscribe" />` is rendered
- **THEN** the component SHALL open an `EventSource` to that URL
- **AND** the component SHALL update its display state based on events from that connection

### Requirement: Lifecycle cleanup

The `ConnectionIndicator` SHALL properly clean up its `EventSource` when the component is removed from the DOM.

#### Scenario: Cleanup on unmount

- **WHEN** the component is removed from the page (client entry is disposed)
- **THEN** the `EventSource` SHALL be closed via `eventSource.close()`
- **AND** no further state updates SHALL occur

### Requirement: Custom connected event support

The indicator SHALL use a custom `connected` event (in addition to the native `open` event) to transition to the connected state, aligning with the channel infrastructure that sends an initial `event: connected` payload.

#### Scenario: Custom connected event

- **WHEN** an `event: connected` SSE event is received
- **THEN** the indicator SHALL transition to the connected state if not already connected
- **AND** any reconnection backoff state SHALL be reset

### Requirement: Integration with admin messages page

The admin messages page SHALL display the connection indicator to show the status of the SSE subscription used for invalidation.

#### Scenario: Indicator in admin messages

- **WHEN** an admin visits the messages page at `/admin/messages`
- **THEN** a `ConnectionIndicator` SHALL be displayed near the page header
- **AND** the indicator SHALL subscribe to `/admin/messages/subscribe`
- **AND** the indicator SHALL show the real-time connection state
