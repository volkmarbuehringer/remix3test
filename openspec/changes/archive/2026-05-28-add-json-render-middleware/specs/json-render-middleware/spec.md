## ADDED Requirements

### Requirement: JSON renderer middleware

The system SHALL provide a request-scoped JSON renderer on `AppContext` that serializes JavaScript values to JSON responses with the correct `Content-Type` header.

#### Scenario: JSON renderer is available on context

- **WHEN** the router processes any request through the middleware stack
- **THEN** `context.json` SHALL be a function on the request context
- **AND** calling `context.json(data)` SHALL return a `Response` with `Content-Type: application/json`

#### Scenario: JSON renderer accepts response options

- **WHEN** a route handler calls `context.json(data, { status: 201 })`
- **THEN** the returned Response SHALL have the specified status code
- **AND** the body SHALL be the JSON-serialized data

#### Scenario: JSON renderer serializes complex data

- **WHEN** a route handler calls `context.json({ ok: true, items: [{ id: 1 }] })`
- **THEN** the Response body SHALL be valid JSON matching the input structure

#### Scenario: JSON renderer handles errors

- **WHEN** a route handler calls `context.json({ error: 'Not found' }, { status: 404 })`
- **THEN** the Response SHALL have status 404
- **AND** the body SHALL be `{"error":"Not found"}`

#### Scenario: JSON renderer co-exists with UI renderer

- **WHEN** a route handler uses both `context.render(...)` and `context.json(...)` in separate actions of the same controller
- **THEN** both renderers SHALL produce correct responses without interfering with each other

### Requirement: Controller migration to JSON renderer

All existing JSON API response calls in controllers SHALL be migrated from manual `new Response(JSON.stringify(...), ...)` and `Response.json(...)` patterns to use `context.json(...)`.

#### Scenario: Simple success response migration

- **WHEN** a controller action currently returns `Response.json({ id: row.id })`
- **THEN** the migrated call SHALL be `context.json({ id: row.id })`
- **AND** the response behavior SHALL be identical

#### Scenario: Error response migration

- **WHEN** a controller action currently returns `new Response(JSON.stringify({ error: 'msg' }), { status: 400, headers: { 'Content-Type': 'application/json' } })`
- **THEN** the migrated call SHALL be `context.json({ error: 'msg' }, { status: 400 })`
- **AND** the response behavior SHALL be identical

#### Scenario: No remaining manual JSON construction

- **WHEN** all controllers have been migrated
- **THEN** a grep for `JSON.stringify` in response body construction SHALL return zero results (excluding tests and unrelated utility code)
