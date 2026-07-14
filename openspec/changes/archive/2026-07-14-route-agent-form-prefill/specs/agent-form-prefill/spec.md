## ADDED Requirements

### Requirement: Route agent SHALL support prefill in navigate events

When the route agent navigates to a form URL and has extracted field values from the conversation, the navigate SSE event SHALL include a `prefill` map. The client SHALL store this data ephemerally and inject it as a header on the subsequent Frame GET fetch.

#### Scenario: Agent navigates with prefill data

- **WHEN** the route agent's `routeNavigate` tool returns `{ type: 'route', path: '/verwaltung/resources?creating=true', data: { name: 'Meeting Room A' } }`
- **THEN** the SSE `navigate` event SHALL include `{ href, target, prefill: { name: 'Meeting Room A' } }`
- **AND** the client SHALL store `{ name: 'Meeting Room A' }` keyed by the current threadId

#### Scenario: Prefill injected on Frame GET

- **WHEN** `resolveFrameResponse` fetches a Frame URL
- **AND** a prefill entry exists for the current threadId
- **THEN** the GET request SHALL include header `X-Agent-Prefill` with a base64-encoded JSON value of the prefill map

#### Scenario: Prefill consumed once

- **WHEN** the Frame GET succeeds
- **THEN** the prefill entry SHALL be removed from the client store
- **AND** a subsequent Frame GET to the same URL SHALL NOT include the `X-Agent-Prefill` header

### Requirement: Controller SHALL render pre-filled field values

When the controller receives a GET with the `X-Agent-Prefill` header, it SHALL decode the prefill values and pass them as `formValues` to the form component, rendering them as input defaults.

#### Scenario: Resource create form pre-fills name

- **WHEN** the agent navigates to `/verwaltung/resources?creating=true`
- **AND** the request carries `X-Agent-Prefill: eyJuYW1lIjoiTWVldGluZyBSb29tIEEifQ==` (base64 of `{"name":"Meeting Room A"}`)
- **THEN** the rendered create form SHALL show "Meeting Room A" as the default value of the name input
- **AND** the description and capabilities inputs SHALL show empty defaults

#### Scenario: Prefilled name is editable

- **WHEN** the resource create form renders with a pre-filled name
- **THEN** the user SHALL be able to edit the name before submitting
- **AND** submitting with the edited name SHALL create the resource with the edited value, not the prefill

#### Scenario: Validation errors preserve user edits, not prefill

- **WHEN** the user edits the pre-filled name and submits with validation errors
- **THEN** the re-rendered form SHALL show the user's edited value, not the original prefill
- **AND** the existing `formValues` and `fieldErrors` re-render behavior SHALL be unchanged

### Requirement: Agent instructions SHALL include prefill extraction rules

The route agent's instructions SHALL include rules for extracting resource names from user messages and including them in navigate calls.

#### Scenario: Agent extracts name from "create a resource called X"

- **WHEN** the user sends "create a resource called Appointment Calendar"
- **THEN** the agent SHALL call `routeNavigate('/verwaltung/resources?creating=true&sort=name&order=asc')` with `data: { name: 'Appointment Calendar' }`

#### Scenario: Agent extracts name from "create resource X"

- **WHEN** the user sends "create resource Emergency Protocol"
- **THEN** the agent SHALL call `routeNavigate('/verwaltung/resources?creating=true&sort=name&order=asc')` with `data: { name: 'Emergency Protocol' }`

#### Scenario: User does not provide a name

- **WHEN** the user sends "create a resource" without specifying a name
- **THEN** the agent SHALL NOT include prefill data
- **AND** the agent SHALL call `routeNavigate` with the form URL as usual
