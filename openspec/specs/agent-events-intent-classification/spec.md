# agent-events-intent-classification Specification

## Purpose

Defines how the agent-events admin pipeline resolves free-text requests into structured intents using LLM generation, including target extraction and the unclear-intent fallback.

## Requirements

### Requirement: LLM-based intent classification
The system SHALL classify each validated admin request by calling the LLM agent with the full message, rather than by matching hardcoded keywords. The classification SHALL produce a structured intent (e.g. cancel-user, lock-user, unlock-user, show-appointments) and its parameters.

#### Scenario: English intent resolves via LLM
- **WHEN** an admin submits `cancel user 42`
- **THEN** the pipeline emits `intent.classified` with intent `cancel-user` and target query `42`

#### Scenario: German verb-final intent resolves via LLM
- **WHEN** an admin submits `ich will john doe sperren`
- **THEN** the pipeline emits `intent.classified` with intent `lock-user` and target query `john doe`

#### Scenario: Target extraction is language-agnostic
- **WHEN** a message names a target by ID, email, or multi-word name in any word order
- **THEN** the classification extracts the full target without relying on token position or a stopword list

### Requirement: Unclear intent fallback
The system SHALL emit `intent.unclear` when the LLM response cannot be parsed into a known intent, or when an actionable intent (cancel/lock/unlock) lacks a resolvable target, and SHALL NOT proceed to entity resolution. A `show-appointments` classification MAY have an empty target (general appointment query).

#### Scenario: Unparseable agent response
- **WHEN** the agent returns text that does not contain a valid intent JSON object
- **THEN** the pipeline emits `intent.unclear` with the response text

#### Scenario: Unsupported request
- **WHEN** an admin message does not map to any known intent
- **THEN** the pipeline emits `intent.unclear` and stops without executing any action

#### Scenario: Actionable intent without target
- **WHEN** the agent classifies an actionable intent but the response omits or leaves empty the target query
- **THEN** the pipeline emits `intent.unclear` rather than emitting an empty-target `intent.classified`

#### Scenario: Appointment check without target
- **WHEN** the agent classifies `show-appointments` without a target query
- **THEN** the pipeline emits `intent.classified` with an empty target query (general query)

### Requirement: Classification bounded by timeout
The LLM classification call SHALL be bounded by a timeout so a slow or hung agent cannot stall the pipeline indefinitely.

#### Scenario: Agent exceeds timeout
- **WHEN** the agent does not respond within the configured timeout
- **THEN** the pipeline aborts classification and emits `intent.unclear` (or a failure event) rather than hanging

### Requirement: Lookup-user intent classification

The system SHALL classify a bare user lookup request as a `lookup-user` intent that navigates to the users page with the resolved target as a filter, without starting a workflow run.

#### Scenario: Admin asks to find a user

- **WHEN** an admin submits a message that resolves to a bare user lookup (e.g. "find user john doe", "zeig mir benutzer 42")
- **THEN** the pipeline SHALL emit `intent.classified` with intent `lookup-user` and the target query
- **AND** the pipeline SHALL navigate to `/admin/users?filter=<target>` without starting a workflow run

#### Scenario: Lookup does not open a confirm gate

- **WHEN** the pipeline classifies a `lookup-user` intent
- **THEN** no workflow run SHALL be started
- **AND** no confirm gate SHALL be presented

### Requirement: Appointment check carries period and status filters

The `show-appointments` classification SHALL preserve the admin's date-period and status references and pass them as `period` and `status` query parameters on the `/verwaltung/appointments` navigation, in addition to the resolved user filter.

#### Scenario: Admin asks about appointments this week

- **WHEN** an admin submits a message referencing a date period (e.g. "show appointments this week", "Termine nächsten Monat")
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` with the matching `period` query parameter (e.g. `this-week`, `next-month`)
- **AND** a resolved target SHALL be included as the `filter` query parameter

#### Scenario: Admin asks about pending appointments

- **WHEN** an admin submits a message referencing a status (e.g. "pending appointments", "expired Termine")
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` with the matching `status` query parameter

#### Scenario: General appointment query carries no filters

- **WHEN** an admin submits a general appointment query without a target, period, or status
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` without `filter`, `period`, or `status` query parameters
