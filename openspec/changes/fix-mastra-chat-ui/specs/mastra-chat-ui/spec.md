## ADDED Requirements

### Requirement: Auto-scroll to latest messages

After the page loads (following a POST redirect with threadId), the conversation area SHALL scroll to show the latest messages.

#### Scenario: Scroll to bottom on load

- **WHEN** the user navigates to `/mastra/chat?threadId=<id>`
- **THEN** the page SHALL scroll the conversation container to its bottom

### Requirement: Compact input form

The message input form SHALL use minimal vertical space to maximize space for conversation history.

#### Scenario: Reduced form height

- **WHEN** the form is rendered
- **THEN** the textarea SHALL be smaller and the form padding SHALL be reduced compared to the current card-style layout

### Requirement: No unused space below form

Content below the form SHALL NOT create unnecessary empty space.

#### Scenario: Bottom of page is form

- **WHEN** the page renders
- **THEN** the form SHALL be the last visible element with no trailing empty space
