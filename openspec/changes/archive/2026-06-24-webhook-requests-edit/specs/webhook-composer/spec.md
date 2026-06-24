## ADDED Requirements

### Requirement: WebhookComposer accepts initial payload for edit mode

The `WebhookComposer` clientEntry component SHALL accept an optional initial payload object. When provided, the key-value grid SHALL be pre-populated with rows derived from that payload. When not provided (create mode), it SHALL start with one empty row as before.

#### Scenario: Initial payload populates the grid

- **WHEN** `WebhookComposer` is rendered with `initialPayload={"foo":"bar","baz":"qux"}`
- **THEN** the grid SHALL display two pre-populated rows: key=`foo`, value=`bar` and key=`baz`, value=`qux`
- **AND** the JSON preview SHALL show `{"foo":"bar","baz":"qux"}`

#### Scenario: Empty initial payload

- **WHEN** `WebhookComposer` is rendered with `initialPayload={}`
- **THEN** the grid SHALL display one empty row (same as create mode)

#### Scenario: Nested or non-string values are converted to strings

- **WHEN** the initial payload contains a numeric value like `{"count":5}`
- **THEN** the value input SHALL display `"5"` (string representation)
- **WHEN** the initial payload contains a nested object like `{"meta":{"nested":true}}`
- **THEN** the value input SHALL display `'{"nested":true}'` (JSON-stringified)

### Requirement: Composer form action varies by mode

The `WebhookComposer` SHALL submit to different endpoints depending on whether it is in create or edit mode.

#### Scenario: Create mode submits to POST /webhook-requests/create

- **WHEN** `WebhookComposer` is rendered without `initialPayload` (or with `editId` unset)
- **THEN** the form SHALL submit via `POST` to `/webhook-requests/create`

#### Scenario: Edit mode submits to PUT /webhook-requests/:id

- **WHEN** `WebhookComposer` is rendered with `editId="<uuid>"`
- **THEN** the form SHALL submit via `PUT` to `/webhook-requests/<id>`
- **AND** it SHALL include hidden grid state inputs (`_offset`, `_sort`, `_order`, `_filter`) for preserving the grid view after save
