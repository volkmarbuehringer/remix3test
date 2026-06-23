## MODIFIED Requirements

### Requirement: SSR page with table of webhook requests

The system SHALL render an SSR page at `/webhook-requests` displaying the contents of the `webhook_requests` table, with a per-row resend action.

#### Scenario: Page renders with data

- **WHEN** a user navigates to `/webhook-requests`
- **THEN** the page SHALL display a table of webhook requests with columns: created_at, payload (truncated), token, source_ip, callback_received_at
- **THEN** each row SHALL include a "Resenden" action button
- **THEN** empty state SHALL display a "No requests yet" message
