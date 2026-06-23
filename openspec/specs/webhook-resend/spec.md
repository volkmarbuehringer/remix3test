## Purpose

A per-row resend action on the webhook-requests grid that clears the callback columns and re-forwards the stored payload to the hermes event processor, enabling operators to retry delivery for webhook requests that failed or whose callback was never received.

## Requirements

### Requirement: Resend action per row

The system SHALL provide a "Resenden" action button on each row of the webhook-requests grid that triggers a resend of the stored payload to hermes.

#### Scenario: Resend button visible per row

- **WHEN** the webhook-requests grid renders rows
- **THEN** each row SHALL display a "Resenden" button
- **THEN** clicking the button SHALL submit a POST request to `/webhook-requests/:id/resend`

#### Scenario: Confirmation before resend

- **WHEN** the user clicks "Resenden"
- **THEN** a browser confirm dialog SHALL appear asking for confirmation
- **THEN** the resend SHALL only proceed if the user confirms

### Requirement: Resend clears callback columns

Before forwarding, the system SHALL set `callback_response` to NULL and `callback_received_at` to NULL for the given webhook request row.

#### Scenario: Callback columns cleared

- **WHEN** a resend is triggered for a webhook request
- **THEN** `callback_response` SHALL be set to NULL
- **THEN** `callback_received_at` SHALL be set to NULL

### Requirement: Resend forwards payload to hermes

The system SHALL POST the webhook payload to the hermes event processor at `HERMES_URL`, matching the existing forwarding behavior.

#### Scenario: Payload forwarded to hermes

- **WHEN** the callback columns have been cleared
- **THEN** the system SHALL POST `{ "id": "<uuid>", "callbackUrl": "<callback_url>", "payload": <stored_payload> }` to `HERMES_URL`
- **THEN** the system SHALL store the hermes HTTP response status in `hermes_status`
- **THEN** the system SHALL broadcast an SSE `new_request` event to connected viewers

#### Scenario: Hermes unreachable

- **WHEN** hermes does not respond within the timeout
- **THEN** `hermes_status` SHALL be set to `"error"`
- **THEN** the page SHALL still render successfully with the updated status

### Requirement: Grid state preserved after resend

After executing the resend, the page SHALL re-render preserving the current offset, sort, and filter parameters.

#### Scenario: Grid state preserved

- **WHEN** a resend completes
- **THEN** the current page offset, sort column, sort direction, and filter SHALL be preserved in the re-rendered grid
