## ADDED Requirements

### Requirement: Extract text from Mastra message content
The `messageContentToText()` function SHALL extract displayable text from Mastra message content across all known formats.

#### Scenario: Plain text string
- **WHEN** content is a plain string
- **THEN** the string SHALL be returned as-is

#### Scenario: Format 2 with parts
- **WHEN** content is an object with `format: 2` and a `parts` array
- **THEN** the `text` field of each `type: "text"` part SHALL be extracted and joined

#### Scenario: Parts without format wrapper
- **WHEN** content is an object with a `parts` array but no `format` field
- **THEN** the `text` field of each `type: "text"` part SHALL be extracted and joined

#### Scenario: Object with text field
- **WHEN** content is an object with a `text` field
- **THEN** the `text` field SHALL be returned

#### Scenario: Array content
- **WHEN** content is an array
- **THEN** each element SHALL be recursively extracted and joined

#### Scenario: Unknown format
- **WHEN** content does not match any known format
- **THEN** an empty string SHALL be returned

### Requirement: Conversation history rendering
Recalled messages with extracted content SHALL render in the MastraChatPage and ChatlogDetailFragment.

#### Scenario: Messages with extracted content display correctly
- **WHEN** recalled messages have non-empty extracted content
- **THEN** they SHALL appear as chat bubbles in the conversation UI

#### Scenario: Messages with empty content are hidden
- **WHEN** recalled messages have empty extracted content
- **THEN** they SHALL be filtered out and not displayed
