## Purpose

Admin can edit an existing webhook request's JSON payload via a side-panel editor that reuses the key-value JSON composer, pre-populated from the row's current payload.

## Requirements

### Requirement: Admin can edit an existing webhook request's JSON payload

The system SHALL allow an admin to modify the payload of an existing webhook request via a side-panel editor that reuses the key-value JSON composer.

#### Scenario: Edit button opens side panel

- **WHEN** the admin views `/webhook-requests`
- **THEN** each row SHALL display an "Edit" action button
- **WHEN** the admin clicks "Edit"
- **THEN** the page SHALL set `?editing=<id>` in the URL
- **AND** the page SHALL render a side panel with the key-value composer pre-populated from the row's current payload

#### Scenario: Side panel shows existing payload

- **WHEN** the edit side panel opens for a row with payload `{"key1":"val1","key2":"val2"}`
- **THEN** the key-value grid SHALL display two rows: `key1` / `val1` and `key2` / `val2`
- **AND** the JSON preview SHALL show the current payload

#### Scenario: Admin modifies payload and saves

- **WHEN** the admin edits a value in the key-value grid and clicks "Speichern"
- **THEN** a PUT request SHALL be sent to `/webhook-requests/<id>` with the updated JSON payload
- **AND** the database row SHALL be updated
- **AND** the admin SHALL remain on `/webhook-requests` with the `?editing=` parameter preserved
- **AND** the table SHALL reflect the updated payload

#### Scenario: Cancel closes the side panel

- **WHEN** the admin clicks "Abbrechen" in the edit panel
- **THEN** the admin SHALL be redirected to `/webhook-requests` without `?editing=`
- **AND** the side panel SHALL close

#### Scenario: Editing does not affect token, source_ip, or timestamps

- **WHEN** the admin edits and saves a payload
- **THEN** only the `payload` column SHALL be updated
- **AND** `token`, `headers`, `source_ip`, `created_at`, `hermes_status`, `callback_response`, `callback_received_at` SHALL remain unchanged

### Requirement: Grid state is preserved during edit

The system SHALL preserve pagination, sort, and filter state while the edit panel is open.

#### Scenario: Save redirect preserves grid state

- **WHEN** the admin saves an edit
- **THEN** the redirect SHALL preserve the `offset`, `sort`, `order`, and `filter` parameters
- **AND** the `?editing=` parameter SHALL remain set to the edited row's ID
