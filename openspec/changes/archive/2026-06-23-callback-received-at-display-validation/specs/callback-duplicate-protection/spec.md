## ADDED Requirements

### Requirement: Reject duplicate callbacks

The callback endpoint SHALL reject a callback for a webhook request that has already received one.

#### Scenario: Duplicate callback rejected

- **WHEN** a valid callback request is sent to `POST /callback` with an `id` that already has a non-null `callback_received_at`
- **THEN** the endpoint SHALL return HTTP 409 Conflict
- **THEN** the existing `callback_response` and `callback_received_at` values SHALL NOT be modified
