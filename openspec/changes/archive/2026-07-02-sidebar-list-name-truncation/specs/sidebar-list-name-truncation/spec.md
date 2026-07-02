## ADDED Requirements

### Requirement: Sidebar list name truncation
The system SHALL truncate overflowing list names in the sidebar with an ellipsis and SHALL show the full name on hover via a CSS tooltip.

#### Scenario: Long name is truncated
- **WHEN** a list name exceeds the available sidebar width
- **THEN** the name SHALL be truncated with `text-overflow: ellipsis` and the full name SHALL be available as a `data-tooltip` attribute on the same element

#### Scenario: Short name is not truncated
- **WHEN** a list name fits within the available sidebar width
- **THEN** the name SHALL display normally without truncation

#### Scenario: Tooltip shows full name
- **WHEN** the user hovers over a truncated list name
- **THEN** a CSS tooltip SHALL appear showing the full list name after a 0.3s delay

#### Scenario: Empty description still shows list ID fallback
- **WHEN** a list has no description/empty label
- **THEN** the fallback display name `Liste #<id>` SHALL be displayed and truncated if needed
