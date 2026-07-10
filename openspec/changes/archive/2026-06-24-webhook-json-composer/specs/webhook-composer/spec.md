## ADDED Requirements

### Requirement: Admin can compose a webhook payload via key-value grid

The system SHALL provide a page at `GET /webhook-requests/create` with a clientEntry-powered grid for composing a JSON payload.

#### Scenario: Grid starts with one empty row

- **WHEN** the admin navigates to `/webhook-requests/create`
- **THEN** the grid SHALL display one empty row with key and value inputs
- **AND** the JSON preview SHALL show `{}`

#### Scenario: Admin adds a row

- **WHEN** the admin clicks "Add Row"
- **THEN** a new empty row SHALL be appended to the grid
- **AND** the JSON preview SHALL update in real-time

#### Scenario: Admin removes a row

- **WHEN** the admin clicks remove on a row
- **THEN** that row SHALL be removed from the grid
- **AND** the JSON preview SHALL update in real-time

#### Scenario: Admin edits a key

- **WHEN** the admin types in a key input
- **THEN** the JSON preview SHALL reflect the new key immediately

#### Scenario: Admin edits a value

- **WHEN** the admin types in a value input
- **THEN** the JSON preview SHALL reflect the new value immediately

### Requirement: Admin can submit the composed payload

The system SHALL accept form submission of the composed JSON payload and insert it into the `webhook_requests` table.

#### Scenario: Successful submit

- **WHEN** the admin clicks "In Tabelle speichern"
- **THEN** a row SHALL be inserted into `webhook_requests` with `payload` set to the composed JSON, `token` set to `''`, `headers` set to `'{}'`, `source_ip` set to the admin's IP, and `created_at` set to the current timestamp
- **AND** the admin SHALL be redirected to `/webhook-requests` with status 303

#### Scenario: Empty keys are excluded

- **WHEN** a row has an empty key
- **THEN** that row SHALL be excluded from the assembled JSON payload on submit

#### Scenario: Duplicate keys override

- **WHEN** multiple rows have the same key
- **THEN** the last value SHALL win in the assembled JSON

### Requirement: Compose button on webhook list page

The system SHALL provide a navigation entry point from the webhook requests list.

#### Scenario: Button navigates to compose page

- **WHEN** the admin views `/webhook-requests`
- **THEN** a "Compose" button SHALL be visible in the page header
- **AND** clicking it SHALL navigate to `/webhook-requests/create`

### Requirement: Inserted rows appear in webhook list

Rows created via the composer SHALL be visible in the existing `/webhook-requests` list and SHALL support the existing "Resenden" action.

#### Scenario: Composed row is visible and resendable

- **WHEN** the admin is redirected to `/webhook-requests` after composing
- **THEN** the newly inserted row SHALL appear in the table
- **AND** the row SHALL have empty hermes_status
- **AND** the "Resenden" button SHALL send the payload to Hermes via the existing resend handler
