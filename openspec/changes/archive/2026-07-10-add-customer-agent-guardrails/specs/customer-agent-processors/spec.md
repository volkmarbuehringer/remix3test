## ADDED Requirements

### Requirement: Unicode normalization
The system SHALL normalize user messages by stripping control characters and collapsing consecutive whitespace before the message reaches the LLM.

#### Scenario: Control characters stripped
- **WHEN** a user message contains control characters (e.g., \x00, \x1F)
- **THEN** the control characters SHALL be removed before the message is sent to the LLM

#### Scenario: Consecutive whitespace collapsed
- **WHEN** a user message contains multiple consecutive spaces, tabs, or newlines
- **THEN** they SHALL be collapsed into single spaces
- **AND** leading and trailing whitespace SHALL be trimmed

### Requirement: Regex-based content blocking
The system SHALL block user messages containing PII (emails, phone numbers, SSNs, credit card numbers), secrets (API keys, bearer tokens, AWS access keys), or URLs (HTTP/HTTPS). Blocking SHALL use regex matching with zero LLM calls.

#### Scenario: Email blocked
- **WHEN** a user message contains an email address (e.g., `user@example.com`)
- **THEN** the message SHALL be blocked
- **AND** the agent SHALL return a tripwire response

#### Scenario: Phone number blocked
- **WHEN** a user message contains a phone number
- **THEN** the message SHALL be blocked

#### Scenario: API key blocked
- **WHEN** a user message contains an API key or bearer token
- **THEN** the message SHALL be blocked

#### Scenario: URL blocked
- **WHEN** a user message contains an HTTP or HTTPS URL
- **THEN** the message SHALL be blocked

### Requirement: Token limit per step
The system SHALL limit the conversation context to 10,000 tokens per agent step, dropping older messages to stay within the limit.

#### Scenario: Context trimmed at each step
- **WHEN** the conversation history exceeds 10,000 tokens at any agent step
- **THEN** the oldest messages SHALL be removed to fit within the limit
- **AND** system messages SHALL be preserved

### Requirement: Per-user cost cap
The system SHALL enforce a $0.50 maximum cumulative cost per user within a rolling 24-hour window. When the limit is exceeded, subsequent requests SHALL be blocked.

#### Scenario: Cost limit blocks request
- **WHEN** a user's cumulative cost exceeds $0.50 in the last 24 hours
- **THEN** the agent request SHALL be blocked
- **AND** a tripwire SHALL be returned

#### Scenario: Per-user isolation
- **WHEN** User A exceeds the cost limit
- **THEN** User B SHALL be unaffected and continue to receive service
