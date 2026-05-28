## Purpose

A reusable, typed SSE (Server-Sent Events) infrastructure that lets any feature create real-time push channels and subscription endpoints without duplicating boilerplate. Replaces the ad-hoc `sseClients` pattern used in `app/lib/messages-sse.ts`.

## Requirements

### Requirement: Typed channel factory

The system SHALL provide a `createChannel<EventMap>()` factory function that returns a channel object with typed event broadcast and subscription methods.

#### Scenario: Channel creation

- **WHEN** code calls `createChannel<{invalidate: void}>()`
- **THEN** a channel object SHALL be returned with `subscribe()` and `broadcast()` methods
- **AND** the `broadcast()` method SHALL accept only event names and payloads matching the `EventMap` type parameter
- **AND** the channel SHALL have no subscribers initially

#### Scenario: Typed event broadcasting

- **WHEN** code calls `channel.broadcast('invalidate')`
- **THEN** the event `invalidate` SHALL be sent to all active subscribers
- **AND** the payload SHALL be validated by the `EventMap` type at compile time
- **AND** a subscriber that has disconnected SHALL be automatically removed during broadcast without throwing

### Requirement: Subscription endpoint helper

The channel object's `subscribe(request)` method SHALL create a complete SSE `Response` with proper headers and lifecycle management.

#### Scenario: Basic subscription response

- **WHEN** `channel.subscribe(request)` is called
- **THEN** the returned `Response` SHALL have `Content-Type: text/event-stream`
- **AND** the response SHALL have `Cache-Control: no-cache`
- **AND** the response SHALL have `Connection: keep-alive`
- **AND** the response SHALL have `X-Accel-Buffering: no`
- **AND** the response body SHALL be a `ReadableStream`

#### Scenario: Initial connected event

- **WHEN** a client subscribes via `channel.subscribe(request)`
- **THEN** an initial `event: connected\ndata: {"status":"connected"}\n\n` SHALL be sent immediately
- **AND** this SHALL happen before any other events

#### Scenario: Heartbeat mechanism

- **WHEN** a channel is created with `{heartbeatMs: 30000}`
- **THEN** a heartbeat comment (`: heartbeat\n\n`) SHALL be sent every 30 seconds to each subscriber
- **AND** the heartbeat SHALL start after the initial connected event
- **AND** if a heartbeat `enqueue()` throws (subscriber disconnected), the subscriber SHALL be removed
- **AND** the heartbeat interval SHALL be cleared when the subscription ends

#### Scenario: Cleanup on client disconnect

- **WHEN** a client disconnects (request is aborted, stream is cancelled)
- **THEN** the subscriber SHALL be removed from the channel
- **AND** the heartbeat interval SHALL be cleared
- **AND** an attempt SHALL be made to close the stream controller gracefully (ignoring errors if already closed)

### Requirement: Heartbeat configuration

The channel SHALL support configurable heartbeat intervals.

#### Scenario: Custom heartbeat interval

- **WHEN** a channel is created with `{heartbeatMs: 15000}`
- **THEN** heartbeats SHALL be sent every 15 seconds

#### Scenario: Heartbeat disabled

- **WHEN** a channel is created with `{heartbeatMs: 0}` or `{heartbeatMs: null}`
- **THEN** no heartbeat SHALL be sent

#### Scenario: Default heartbeat

- **WHEN** a channel is created without specifying `heartbeatMs`
- **THEN** the default heartbeat interval of 30 seconds SHALL be used

### Requirement: Broadcast event format

The channel SHALL format SSE events per the SSE specification (text/event-stream).

#### Scenario: Event with data

- **WHEN** `channel.broadcast('message', {text: 'hello'})` is called
- **THEN** each subscriber SHALL receive `event: message\ndata: {"text":"hello"}\n\n`

#### Scenario: Event with empty data (void payload)

- **WHEN** `channel.broadcast('invalidate')` is called with a `void` payload type
- **THEN** each subscriber SHALL receive `event: invalidate\ndata: {}\n\n`

## Integration Requirements

### Requirement: Replace existing ad-hoc admin messages SSE

The admin messages page SHALL use the new channel infrastructure instead of the bare `sseClients` Set from `app/lib/messages-sse.ts`.

#### Scenario: Admin messages channel

- **WHEN** the admin messages controller subscribes to SSE
- **THEN** it SHALL use `adminChannel.subscribe(request)` from the new infrastructure
- **AND** broadcasts from `broadcastInvalidate()` SHALL use `adminChannel.broadcast('invalidate')`

#### Scenario: Backward compatibility during migration

- **WHEN** `broadcastInvalidate()` from `app/lib/messages-sse.ts` is called
- **THEN** it SHALL forward the invalidation to the new admin channel
- **OR** callers SHALL be updated to use the new channel directly

### Requirement: Channel module exports

The `app/lib/sse.ts` module SHALL export the `createChannel` factory as its primary API.

#### Scenario: Module exports

- **WHEN** a module imports from `app/lib/sse.ts`
- **THEN** it SHALL be able to import `createChannel` as a named export
- **AND** the `Channel` and `ChannelOptions` types SHALL be exported for type annotations
