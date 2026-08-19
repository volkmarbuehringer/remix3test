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
