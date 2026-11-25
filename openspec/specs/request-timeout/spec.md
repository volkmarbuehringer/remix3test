# Request Timeout

## Purpose

Bound non-streaming requests with an opt-in deadline so a slow handler cannot hold a connection, session, or database resource indefinitely, while leaving server-sent event streams and cooperative downstream work intact.

## Requirements

### Requirement: Opt-in request deadline

The root middleware chain SHALL apply a request deadline only when `REQUEST_TIMEOUT_MS` is a positive number, and SHALL pass requests through unchanged when it is unset.

#### Scenario: Deadline configured

- **WHEN** `REQUEST_TIMEOUT_MS=30000`
- **AND** a request's handler does not return within 30 seconds
- **THEN** the middleware SHALL respond `504 Gateway Timeout`
- **AND** the response SHALL carry `Cache-Control: no-store`
- **AND** the body of a response that arrives after the deadline SHALL be cancelled

#### Scenario: Deadline disabled

- **WHEN** `REQUEST_TIMEOUT_MS` is unset or not a positive number
- **THEN** requests SHALL pass through unchanged
- **AND** no request signal listeners or timers SHALL be installed by the middleware

### Requirement: Downstream work observes the deadline

The middleware SHALL replace `context.request` with a request whose signal aborts when either the caller disconnects or the deadline passes, so handlers, middleware, and outbound fetches that use `context.request.signal` stop cooperatively.

#### Scenario: Handler observes the signal

- **WHEN** the deadline passes while a handler is fetching external work with `context.request.signal`
- **THEN** that fetch SHALL abort
- **AND** the middleware SHALL answer `504` if the handler does not return before the deadline

### Requirement: SSE streams are exempt

Requests identified as server-sent event streams SHALL NOT receive a deadline, because their response body is intentionally long-lived.

#### Scenario: EventSource request

- **WHEN** the request carries `Accept: text/event-stream`
- **THEN** no deadline SHALL be applied
- **AND** the stream SHALL remain open until the client disconnects

#### Scenario: fetch()-based SSE request

- **WHEN** the request carries `X-Sse-Request: 1`
- **THEN** no deadline SHALL be applied
