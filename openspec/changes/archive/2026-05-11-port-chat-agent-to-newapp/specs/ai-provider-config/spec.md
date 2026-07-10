## ADDED Requirements

### Requirement: AI provider configuration

The system SHALL provide a shared configuration for the OpenAI-compatible LLM provider that connects to the OpenCode API gateway.

#### Scenario: Provider initialization with API key

- **WHEN** `getProvider()` is called and `OPENCODE_API_KEY` environment variable is set
- **THEN** it SHALL return an OpenAI-compatible provider configured with base URL `https://opencode.ai/zen/go/v1`

#### Scenario: Provider initialization without API key

- **WHEN** `getProvider()` is called and `OPENCODE_API_KEY` environment variable is NOT set
- **THEN** it SHALL throw an error with a message indicating the missing environment variable

### Requirement: Model access with dev tools middleware

The system SHALL provide a convenience function `getModel()` that returns a wrapped language model with dev tools middleware enabled.

#### Scenario: Model initialization

- **WHEN** `getModel()` is called
- **THEN** it SHALL return a model wrapped with `devToolsMiddleware()`, using the `minimax-m2.7` chat model from the configured provider

#### Scenario: Singleton behavior

- **WHEN** `getProvider()` or `getModel()` is called multiple times
- **THEN** the same cached instance SHALL be returned on subsequent calls
