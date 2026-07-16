## ADDED Requirements

### Requirement: Tool defines typed output schema

Every Mastra tool in the project SHALL define an `outputSchema` that describes the full output shape using Zod schemas. Each field MUST include a `.describe()` declaration explaining its semantics, units, and purpose to the LLM.

#### Scenario: outputSchema validates success returns

- **WHEN** a tool's `execute` function returns a success result
- **THEN** the output schema SHALL validate it matches the success shape
- **AND** the LLM SHALL receive the full output with field-level descriptions

#### Scenario: outputSchema validates error returns

- **WHEN** a tool's `execute` function returns an error result
- **THEN** the output schema SHALL validate it matches the error shape
- **AND** the LLM SHALL receive typed error fields

### Requirement: Error results use discriminated union

Error and success results SHALL be distinguished by a `success: true | false` discriminant at the top level. The error shape SHALL include a machine-readable `code` (enum) and a human-readable `message`.

#### Scenario: LLM detects success

- **WHEN** a tool call succeeds
- **THEN** the result SHALL contain `{ success: true, data: { ... } }`
- **AND** the LLM SHALL check `success` to determine the result type

#### Scenario: LLM detects and handles error

- **WHEN** a tool call fails
- **THEN** the result SHALL contain `{ success: false, error: { code, message } }`
- **AND** the LLM SHALL use `error.code` to determine recovery strategy
- **AND** the LLM SHALL use `error.message` to inform the user

### Requirement: Error codes are categorical

Error codes SHALL be a `z.enum` of `VALIDATION`, `NOT_FOUND`, `DEPENDENCY`, `INTERNAL`. Each represents a distinct recovery category.

#### Scenario: Validation error

- **WHEN** input is structurally valid but semantically invalid (e.g. path traversal, bad extension)
- **THEN** the error code SHALL be `VALIDATION`
- **AND** the LLM SHALL explain the constraint to the user

#### Scenario: Not found error

- **WHEN** a requested entity does not exist
- **THEN** the error code SHALL be `NOT_FOUND`

#### Scenario: Dependency failure

- **WHEN** a filesystem, database, or network operation fails
- **THEN** the error code SHALL be `DEPENDENCY`
- **AND** the LLM SHALL suggest retrying

#### Scenario: Internal error

- **WHEN** an unexpected error occurs with no specific category
- **THEN** the error code SHALL be `INTERNAL`

### Requirement: Display fields are described not hidden

Tool output MAY include display-oriented fields (e.g. `formattedSize`, `icon`, `type` as strings) alongside raw data fields. The `outputSchema` SHALL describe the purpose of each display field so the LLM can use them for user-facing formatting while using raw fields for comparison and sorting.

#### Scenario: LLM uses raw fields for logic

- **WHEN** the LLM needs to compare file sizes or sort by modification time
- **THEN** the LLM SHALL use `size` (bytes) and `mtime` (Unix ms) fields

#### Scenario: LLM uses display fields for user output

- **WHEN** the LLM formats file information for the user
- **THEN** the LLM MAY use `display.formattedSize` (e.g. "1.23 KiB") for user-facing output
