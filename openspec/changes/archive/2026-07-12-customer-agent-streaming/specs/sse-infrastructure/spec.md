## ADDED Requirements

### Requirement: SSE stream store SHALL be used by the customer chat route

The existing stream store in `app/utils/stream-store.ts` SHALL be the only mechanism for serving agent stream data to the customer chat client. The customer chat controller SHALL NOT create its own stream storage.

#### Scenario: Customer chat stores streams in the shared store
- **WHEN** the customer chat controller calls `agent.stream()`
- **THEN** SHALL call `setStream(runId, stream)` with the returned stream
- **AND** SHALL NOT use any other storage mechanism for stream data

#### Scenario: Customer chat serves streams via the shared store
- **WHEN** the client requests `/chat/stream/:runId`
- **THEN** the customer chat stream endpoint SHALL call `getStream(runId)` to retrieve the stored stream
- **AND** SHALL read events from `stored.fullStream` to produce the SSE response

### Requirement: Customer chat SHALL have an SSE route

The routes definition SHALL include a `/chat/stream/:runId` route following the same pattern as `/testagent/stream/:runId`.

#### Scenario: Chat stream route exists
- **WHEN** the routes file is loaded
- **THEN** a `stream` sub-route SHALL exist under the `chat` route with pattern `get('/stream/:runId')`
- **AND** the controller SHALL expose a `stream` action for this route
