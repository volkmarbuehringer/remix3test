## Purpose

Gives the support-agent chat structured interaction surfaces: an in-chat question card for single- and multi-select clarifications instead of the native prompt, and structured rendering of tool results so the admin sees readable output rather than raw streamed text.

## ADDED Requirements

### Requirement: Clarification questions render as an in-chat card

The support-agent chat SHALL render `ask_user` clarifications as a structured question card inside the chat area, with selectable options and a confirm control, and SHALL NOT use the native browser prompt for collecting a single-select answer.

#### Scenario: Single-select question renders options

- **WHEN** the agent suspends with a single-select `ask_user` question and options
- **THEN** the chat SHALL render a card with the question text, the options visually stacked, and a confirm control
- **AND** the admin SHALL be able to select one option and confirm without a native prompt

#### Scenario: Multi-select question renders checkable options

- **WHEN** the agent suspends with a multi-select `ask_user` question and options
- **THEN** the card SHALL render checkable options
- **AND** the confirmed answer SHALL be submitted as a multi-value selection

#### Scenario: The card is theme-consistent and keyboard accessible

- **WHEN** the question card is rendered
- **THEN** it SHALL be styled through the theme token system
- **AND** every option and the confirm control SHALL be reachable and operable by keyboard

#### Scenario: An answer resumes the run

- **WHEN** the admin confirms an answer in the card
- **THEN** the system SHALL resume the suspended run with the selected answer and the same run id

### Requirement: Tool results render as structured output

The support-agent chat SHALL render tool results as structured output (for example tables, lists, or detail cards) instead of relying solely on raw streamed text, so administrators can read results quickly.

#### Scenario: List results render as a table or list

- **WHEN** a tool returns a collection result (appointments, users, offerings, messages)
- **THEN** the chat SHALL render the result as a structured table or list with the relevant columns
- **AND** the raw text SHALL not be required to understand the result

#### Scenario: Detail results render as a card

- **WHEN** a tool returns a single-entity detail (appointment, user, resource, offering config)
- **THEN** the chat SHALL render it as a detail card with labeled fields

#### Scenario: Generated PDF renders as a downloadable artifact

- **WHEN** a tool returns generated PDF data
- **THEN** the chat SHALL render it as a downloadable artifact link

#### Scenario: Empty results render a clear empty state

- **WHEN** a tool returns an empty collection
- **THEN** the chat SHALL render a clear empty state rather than a bare zero-count message
