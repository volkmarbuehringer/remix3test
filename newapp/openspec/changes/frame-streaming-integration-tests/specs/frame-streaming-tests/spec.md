## ADDED Requirements

### Requirement: Admin page streams frames incrementally

The system SHALL verify that the admin dashboard page (`/admin`) streams fallback content before frame content, and that resolved frame content arrives wrapped in `<template>` tags. The admin page uses `<Frame name="adminContent">` which triggers nested frame loading for stats and recent activity fragments.

#### Scenario: Admin page streams fallback content first

- **WHEN** an authenticated admin user requests `/admin`
- **THEN** the initial streaming chunk SHALL contain fallback content (the admin sidebar layout) before any resolved frame content
- **AND** the initial chunk SHALL NOT contain `<template>` tags (frames have not yet resolved)

#### Scenario: Admin page resolves fragments progressively

- **WHEN** an authenticated admin user requests `/admin` and the stream is consumed incrementally
- **THEN** resolved frame content SHALL arrive wrapped in `<template>` tags
- **AND** the stats and recent activity frame content SHALL eventually appear in the stream

### Requirement: AI page streams frames incrementally

The system SHALL verify that the AI dashboard page (`/ai`) streams fallback content before frame content, and that resolved frame content arrives wrapped in `<template>` tags.

#### Scenario: AI page streams fallback content first

- **WHEN** an authenticated user requests `/ai`
- **THEN** the initial streaming chunk SHALL contain fallback content (the AI sidebar layout) before any resolved frame content
- **AND** the initial chunk SHALL NOT contain `<template>` tags

#### Scenario: AI page resolves frame content

- **WHEN** an authenticated user requests `/ai` and the stream is consumed incrementally
- **THEN** resolved frame content SHALL arrive wrapped in `<template>` tags
- **AND** the AI dashboard heading SHALL eventually appear in the stream

### Requirement: Fragment endpoints render without Layout wrapper

The system SHALL verify that frame fragment endpoints render content without the outer `Layout`/`Document` wrapper, producing only the fragment HTML.

#### Scenario: Admin stats fragment renders standalone

- **WHEN** an authenticated admin user requests `/admin/fragments/stats`
- **THEN** the response SHALL contain the stats content (server time, uptime)
- **AND** the response SHALL NOT contain the outer `<html>` or `Document` structure

#### Scenario: Admin recent-activity fragment renders standalone

- **WHEN** an authenticated admin user requests `/admin/fragments/recent-activity`
- **THEN** the response SHALL contain activity entries
- **AND** the response SHALL NOT contain the outer `<html>` or `Document` structure

#### Scenario: AI agent-result fragment renders standalone

- **WHEN** an authenticated user requests `/ai/fragments/agent-result?prompt=test`
- **THEN** the response SHALL contain the agent result content
- **AND** the response SHALL NOT contain the outer `<html>` or `Document` structure

### Requirement: Streaming helpers are available

The test file SHALL provide helper functions for consuming and inspecting streaming responses: `readChunks(stream)` to decode a ReadableStream into string chunks, `readUntil(chunks, predicate)` to accumulate chunks until a condition is met, and `countTemplates(html)` to count `<template>` tags in accumulated HTML.

#### Scenario: readChunks yields decoded string chunks

- **WHEN** `readChunks` is called with a `ReadableStream<Uint8Array>`
- **THEN** it SHALL yield decoded string chunks as an `AsyncGenerator<string, void, void>`

#### Scenario: readUntil accumulates chunks until predicate matches

- **WHEN** `readUntil` is called with an async generator and a predicate function
- **THEN** it SHALL accumulate chunks into a string
- **AND** return the accumulated string once the predicate returns `true`

#### Scenario: countTemplates counts template tags

- **WHEN** `countTemplates` is called with an HTML string
- **THEN** it SHALL return the number of `<template` occurrences in the string
